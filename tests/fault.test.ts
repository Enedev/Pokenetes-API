import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';
import { faultFromEnv, MAX_FAULT_LATENCY_MS, parseErrorRate, parseLatency } from '../src/http/fault';
import { mockEnv, createCrudClient } from './helpers';

const canaryEnv = { ...mockEnv, APP_TRACK: 'canary' };

function canary(env = canaryEnv, random = () => 0) {
  const sleep = vi.fn(async () => undefined);
  const client = createCrudClient({ data: [] });
  return { sleep, client, app: buildApp(env, client, undefined, { random, sleep }) };
}

describe('fault parsing', () => {
  it('bounds latency and error rate', () => {
    expect(parseLatency('250')).toBe(250);
    expect(parseLatency('999999')).toBe(MAX_FAULT_LATENCY_MS);
    expect(parseLatency('-1')).toBeUndefined();
    expect(parseLatency('abc')).toBeUndefined();
    expect(parseErrorRate('0.3')).toBe(0.3);
    expect(parseErrorRate('7')).toBe(1);
    expect(parseErrorRate('-2')).toBe(0);
    expect(parseErrorRate(undefined)).toBeUndefined();
  });

  it('reads defaults from the environment', () => {
    expect(faultFromEnv({ ...mockEnv, FAULT_LATENCY_MS: '100', FAULT_ERROR_RATE: '0.5' })).toEqual({
      latencyMs: 100,
      errorRate: 0.5,
    });
    expect(faultFromEnv(mockEnv)).toEqual({ latencyMs: 0, errorRate: 0 });
  });
});

describe('fault injection on the canary', () => {
  it('returns 500 from the error-rate header before touching the database', async () => {
    const { app, client } = canary();
    const response = await (await app).inject({
      method: 'POST',
      url: '/api/pokemon',
      headers: { 'x-fault-error-rate': '1' },
      payload: { nombre: 'Mew', tipo: 'Psiquico' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['x-fault-injected']).toBe('error');
    expect(response.headers['x-app-track']).toBe('canary');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('delays requests from the latency header', async () => {
    const { app, sleep } = canary();
    const response = await (await app).inject({
      method: 'GET',
      url: '/api/pokemon',
      headers: { 'x-fault-latency-ms': '300' },
    });

    expect(response.statusCode).toBe(200);
    expect(sleep).toHaveBeenCalledWith(300);
    expect(response.headers['x-fault-injected']).toBe('latency');
  });

  it('injects only the share given by the error rate', async () => {
    const { app } = canary(canaryEnv, () => 0.9);
    const response = await (await app).inject({
      method: 'GET',
      url: '/api/pokemon',
      headers: { 'x-fault-error-rate': '0.5' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('applies the env defaults to every request', async () => {
    const { app } = canary({ ...canaryEnv, FAULT_ERROR_RATE: '1' });
    expect((await (await app).inject({ method: 'GET', url: '/api/pokemon' })).statusCode).toBe(500);
  });

  it('never breaks the health check', async () => {
    const { app } = canary({ ...canaryEnv, FAULT_ERROR_RATE: '1' });
    expect((await (await app).inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('turns faults on and off at runtime', async () => {
    const app = await canary().app;

    const on = await app.inject({ method: 'PUT', url: '/api/v3/fault', payload: { error_rate: 1, latency_ms: 50 } });
    expect(on.json()).toEqual({ track: 'canary', latency_ms: 50, error_rate: 1 });
    expect((await app.inject({ method: 'GET', url: '/api/pokemon' })).statusCode).toBe(500);

    const off = await app.inject({ method: 'DELETE', url: '/api/v3/fault' });
    expect(off.json()).toEqual({ track: 'canary', latency_ms: 0, error_rate: 0 });
    expect((await app.inject({ method: 'GET', url: '/api/pokemon' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v3/fault' })).json().error_rate).toBe(0);
  });

  it('requires the token when one is configured', async () => {
    const app = await canary({ ...canaryEnv, FAULT_TOKEN: 'demo' }).app;

    expect((await app.inject({ method: 'PUT', url: '/api/v3/fault', payload: { error_rate: 1 } })).statusCode).toBe(403);
    const ignored = await app.inject({ method: 'GET', url: '/api/pokemon', headers: { 'x-fault-error-rate': '1' } });
    expect(ignored.statusCode).toBe(200);

    const allowed = await app.inject({
      method: 'GET',
      url: '/api/pokemon',
      headers: { 'x-fault-error-rate': '1', 'x-fault-token': 'demo' },
    });
    expect(allowed.statusCode).toBe(500);
  });
});

describe('fault injection on the stable track', () => {
  it('ignores the fault headers and has no fault endpoint', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [] }), undefined, { random: () => 0 });

    const response = await app.inject({ method: 'GET', url: '/api/pokemon', headers: { 'x-fault-error-rate': '1' } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-fault-injected']).toBeUndefined();
    expect((await app.inject({ method: 'PUT', url: '/api/v3/fault', payload: { error_rate: 1 } })).statusCode).toBe(404);
  });

  it('ignores the env defaults too', async () => {
    const app = await buildApp({ ...mockEnv, FAULT_ERROR_RATE: '1' }, createCrudClient({ data: [] }));
    expect((await app.inject({ method: 'GET', url: '/api/pokemon' })).statusCode).toBe(200);
  });
});
