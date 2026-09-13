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
