import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createCrudClient } from './helpers';

const lastPokemon = {
  id: 'pokemon-9',
  nombre: 'Mewtwo',
  tipo: 'Psiquico',
  nivel: 70,
};

describe('GET /api/v2/:entity/last', () => {
  it('returns only the last local record', async () => {
    const fetchImpl = vi.fn();
    const app = await buildApp(mockEnv, createCrudClient({ data: [lastPokemon] }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.version).toBe('2.0.0');
    expect(body.entity).toBe('pokemon');
    expect(body.local).toEqual(lastPokemon);
    expect(body.peers).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(body.trace_id).toBeTruthy();
  });

  it('does not treat last as an id on GET /api/v2/pokemon/last', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [lastPokemon] }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' });

    expect(response.statusCode).toBe(200);
    expect(response.json().entity).toBe('pokemon');
    expect(response.json().local).toEqual(lastPokemon);
  });
});
