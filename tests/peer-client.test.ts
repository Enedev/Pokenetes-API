import { describe, it, expect, vi } from 'vitest';
import { fetchPeerLast } from '../src/integrations/peer-client';

describe('fetchPeerLast', () => {
  it('reads the last item from a live list response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }, { id: 2, title: 'Clean Code' }],
    });

    const result = await fetchPeerLast({
      api: 'biblio-express',
      entity: 'books',
      baseUrl: 'https://biblio.example.test',
      lastPath: '/api/v2/books/last',
      listPath: '/api/books',
      traceId: 'trace-1',
      fetchImpl,
    });

    expect(result.live).toBe(true);
    expect(result.data).toEqual({ id: 2, title: 'Clean Code' });
    expect(result.source).toContain('/api/v2/books/last');
  });

  it('falls back to the list path when last is unavailable', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'missing' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ hospitals: [{ id: 'h1' }, { id: 'h2' }] }),
      });

    const result = await fetchPeerLast({
      api: 'hospitaline',
      entity: 'hospitals',
      baseUrl: 'https://hospitaline.example.test',
      lastPath: '/api/v2/hospitals/last',
      listPath: '/api/v1/hospitals',
      traceId: 'trace-2',
      fetchImpl,
    });

    expect(result.live).toBe(true);
    expect(result.data).toEqual({ id: 'h2' });
    expect(result.source).toContain('/api/v1/hospitals');
  });

  it('keeps Hospitaline trace ids that sit outside local', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        api: 'hospitaline',
        version: '2.0.0',
        'x-trace_id': '0104c82f-e32f-4023-aa54-39a510a42579',
        'trace-id': 'f5c35f8b78907d610d86b30185e33de1',
        'span-id': '0dcd8eef3dca74c6',
        entity: 'hospital',
        local: {
          id: 'ff514126-e11a-4b8a-91c8-360d3b4b67bd',
          name: 'Hospitaline Test',
        },
      }),
    });

    const result = await fetchPeerLast({
      api: 'hospitaline',
      entity: 'hospitals',
      baseUrl: 'http://34.27.58.84',
      lastPath: '/api/v2/hospitals/last',
      listPath: '/api/v1/hospitals',
      traceId: '0104c82f-e32f-4023-aa54-39a510a42579',
      fetchImpl,
    });

    expect(result.data).toEqual({
      id: 'ff514126-e11a-4b8a-91c8-360d3b4b67bd',
      name: 'Hospitaline Test',
      api: 'hospitaline',
      version: '2.0.0',
      'x-trace_id': '0104c82f-e32f-4023-aa54-39a510a42579',
      'trace-id': 'f5c35f8b78907d610d86b30185e33de1',
      'span-id': '0dcd8eef3dca74c6',
      entity: 'hospital',
    });
  });

  it('unwraps a book object and keeps the trace id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        book: { id: 5, title: 'Libro Sintetico 5' },
        api: 'biblio-express',
        'x-trace-id': 'trace-book',
      }),
    });

    const result = await fetchPeerLast({
      api: 'biblio-express',
      entity: 'books',
      baseUrl: 'https://biblio.example.test',
      lastPath: '/api/v5/books/last',
      listPath: '/api/v5/books',
      traceId: 'trace-book',
      fetchImpl,
    });

    expect(result.data).toMatchObject({ id: 5, title: 'Libro Sintetico 5', 'x-trace-id': 'trace-book' });
  });

  it('does not invent data when the peer URL is missing', async () => {
    const result = await fetchPeerLast({
      api: 'biblio-express',
      entity: 'books',
      lastPath: '/api/v2/books/last',
      listPath: '/api/books',
      traceId: 'trace-3',
    });

    expect(result.live).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toContain('not configured');
  });
});
