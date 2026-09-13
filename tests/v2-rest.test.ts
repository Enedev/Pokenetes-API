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

  it('returns one local pokemon by id', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/pokemon-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(pikachu);
  });
});
