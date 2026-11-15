import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { createCrudClient, mockEnv } from './helpers';

const pokemon = { id: 'poke-1', nombre: 'Lucario', tipo: 'Lucha', nivel: 45, created_at: '2026-11-15T00:00:00.000Z' };

function peers() {
  return vi.fn(async (url: string) => {
    if (url.includes('books')) {
      return { ok: true, status: 200, json: async () => ({ local: { id: 10, title: 'It' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ local: { id: 'h1', name: 'Hospitaline' } }) };
  });
}

describe('GET /api/v2/flujo', () => {
  it('chains pokemon, book and hospital last with one trace id', async () => {
    const fetchImpl = peers();
    const app = await buildApp(mockEnv, createCrudClient({ data: [pokemon] }), fetchImpl);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/flujo',
      headers: { 'x-trace-id': 'trace-flujo' },
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body['x-trace_id']).toBe('trace-flujo');
    expect(body.order).toEqual(['pokemon', 'books', 'hospitals']);
    expect(body.steps.map((step: { entity: string }) => step.entity)).toEqual(['pokemon', 'books', 'hospitals']);
    expect(body.steps[0].data.nombre).toBe('Lucario');
    expect(body.steps[0].data.apodo).toBeUndefined();
    expect(body.steps[1].data).toEqual({ id: 10, title: 'It' });
    expect(body.steps[2].data).toEqual({ id: 'h1', name: 'Hospitaline' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v2/books/last');
    expect(fetchImpl.mock.calls[1][0]).toContain('/api/v2/hospitals/last');
  });

  it('delays only the outbound book call when x-peer-latency-ms is set', async () => {
    const fetchImpl = peers();
    const app = await buildApp(mockEnv, createCrudClient({ data: [pokemon] }), fetchImpl);
    const started = Date.now();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/flujo',
      headers: { 'x-peer-latency-ms': '40' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().latency_ms).toBe(40);
    expect(response.json().latency_target).toBe('biblio-express');
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });

  it('stops waiting for the slow book when resilience is on', async () => {
    const fetchImpl = vi.fn((url: string) => url.includes('books')
      ? new Promise(() => undefined)
      : Promise.resolve({ ok: true, status: 200, json: async () => ({ local: { id: 'h1' } }) }));
    const app = await buildApp(mockEnv, createCrudClient({ data: [pokemon] }), fetchImpl);
    const started = Date.now();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/flujo',
      headers: { 'x-peer-latency-ms': '5000', 'x-peer-resilience': 'true' },
    });
    const book = response.json().steps[1];

    expect(response.statusCode).toBe(200);
    expect(response.json().resilience).toBe(true);
    expect(book.live).toBe(false);
    expect(book.error).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
