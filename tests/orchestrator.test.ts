import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextFromTraceparent, tracedHeaders } from '../orchestrator/src/http';
import { buildOrchestratorApp } from '../orchestrator/src/app';
import { clearFlujos } from '../orchestrator/src/store';
import { OrchestratorEnv } from '../orchestrator/src/config/env';

const env: OrchestratorEnv = {
  PORT: 3001,
  NODE_ENV: 'test',
  POKENETES_API_URL: 'http://pokenetes.test',
  BIBLIO_LAST_PATH: '/api/v2/books/last',
  BIBLIO_LIST_PATH: '/api/books',
  HOSPITALINE_LAST_PATH: '/api/v2/hospitals/last',
  HOSPITALINE_LIST_PATH: '/api/v1/hospitals',
};

describe('orchestrator traceparent', () => {
  it('keeps the orchestrator trace id on the outbound header', () => {
    const parent = contextFromTraceparent('00-ee67132e912f5b435675fa5293b262a9-a7dca220defa6895-01');
    const headers = tracedHeaders('d723b6f2-9e4d-4110-a037-9280d500eb6b', parent);

    expect(headers.traceparent).toBe('00-ee67132e912f5b435675fa5293b262a9-a7dca220defa6895-01');
    expect(headers['x-trace-id']).toBe('d723b6f2-9e4d-4110-a037-9280d500eb6b');
  });
});

describe('orchestrator flujo', () => {
  beforeEach(() => {
    clearFlujos();
  });

  it('runs the saga with the local API and skips missing peer clouds', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/api/v2/pokemon/last')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ local: { nombre: 'Pikachu' } }),
        };
      }

      return { ok: false, status: 404, json: async () => ({}) };
    });

    const app = await buildOrchestratorApp(env, fetchImpl);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v2/flujo',
      payload: { entity: 'pokemon' },
    });

    expect(created.statusCode).toBe(202);
    const body = created.json();
    expect(created.headers['x-trace-id']).toBe(body.trace_id);
    expect(body.status).toBe('completed');
    expect(body.steps[0]).toMatchObject({ name: 'pokenetes', cloud: 'aws', status: 'ok' });
    expect(body.steps[0].data).toEqual({ nombre: 'Pikachu' });
    expect(body.steps[1]).toMatchObject({ name: 'biblio-express', cloud: 'azure', status: 'skipped' });
    expect(body.steps[2]).toMatchObject({ name: 'hospitaline', cloud: 'gcp', status: 'skipped' });

    const stored = await app.inject({ method: 'GET', url: `/api/v2/flujo/${body.trace_id}` });
    expect(stored.statusCode).toBe(200);
    expect(stored.json().trace_id).toBe(body.trace_id);
  });

  it('flujo-aws asks Pokenetes getById and keeps the peers that API returns', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      const target = String(url);
      if (target.endsWith('/api/v2/pokemon/last')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ local: { id: 'pokemon-1', nombre: 'Pikachu' } }),
        };
      }
      if (target.endsWith('/api/v2/pokemon/pokemon-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            local: { id: 'pokemon-1', nombre: 'Pikachu' },
            peers: {
              'biblio-express': { live: true },
              hospitaline: { live: true },
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const app = await buildOrchestratorApp({
      ...env,
      BIBLIO_API_URL: 'http://biblio.test',
      HOSPITALINE_API_URL: 'http://hospitaline.test',
    }, fetchImpl);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v2/flujo-aws',
      payload: { entity: 'pokemon' },
    });
    const body = created.json();

    expect(created.statusCode).toBe(202);
    expect(body.entry).toBe('aws');
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0].source).toBe('http://pokenetes.test/api/v2/pokemon/pokemon-1');
    expect(body.steps[0].data.peers.hospitaline.live).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown entity', async () => {
    const app = await buildOrchestratorApp(env, vi.fn());
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/flujo',
      payload: { entity: 'libro' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when the flujo does not exist', async () => {
    const app = await buildOrchestratorApp(env, vi.fn());
    const response = await app.inject({ method: 'GET', url: '/api/v2/flujo/missing' });
    expect(response.statusCode).toBe(404);
  });

  it('reports an in-memory queue on health when SQS is not configured', async () => {
    const app = await buildOrchestratorApp(env, vi.fn());
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.json()).toMatchObject({ status: 'ok', queue: 'memory' });
  });
});
