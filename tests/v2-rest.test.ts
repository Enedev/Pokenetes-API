import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createCrudClient } from './helpers';

const pikachu = {
  id: 'pokemon-1',
  nombre: 'Pikachu',
  tipo: 'Electrico',
  nivel: 5,
};

describe('GET /api/v2/pokemon', () => {
  it('lists only local pokemon without composing peers', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [pikachu] }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([pikachu]);
  });

  it('returns one local pokemon by id plus live last records from the other clouds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ title: 'Clean Code', author: 'Robert C. Martin' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'Hospital Central', city: 'Medellin' }),
      });

    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/pokemon-1' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.entity).toBe('pokemon');
    expect(body.local).toEqual(pikachu);
    expect(body.peers['biblio-express'].live).toBe(true);
    expect(body.peers['biblio-express'].data).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
    });
    expect(body.peers.hospitaline.live).toBe(true);
    expect(body.peers.hospitaline.data).toEqual({
      name: 'Hospital Central',
      city: 'Medellin',
    });
  });

  it('keeps the local record when a peer is down', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/pokemon-1' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.local).toEqual(pikachu);
    expect(body.peers['biblio-express'].live).toBe(false);
    expect(body.peers.hospitaline.live).toBe(false);
    expect(body.peers['biblio-express'].data).toBeNull();
  });
});
