import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';
import { parseApodo, toPokemonV3 } from '../src/routes/pokemon-v3';
import { mockEnv, createCrudClient } from './helpers';

const withApodo = {
  id: 'pokemon-1',
  nombre: 'Pikachu',
  apodo: 'Chispa',
  tipo: 'Electrico',
  nivel: 5,
  created_at: '2026-10-27T00:00:00.000Z',
};

const legacy = {
  id: 'pokemon-2',
  nombre: 'Bulbasaur',
  tipo: 'Planta',
  nivel: 3,
  created_at: '2026-10-26T00:00:00.000Z',
};

function insertedValues(client: ReturnType<typeof createCrudClient>) {
  const from = client.from as unknown as ReturnType<typeof vi.fn>;
  const query = from.mock.results[0].value as { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  return (query.insert.mock.calls[0] ?? query.update.mock.calls[0])[0];
}

describe('toPokemonV3', () => {
  it('shows the apodo when there is one', () => {
    expect(toPokemonV3(withApodo)).toEqual({ ...withApodo, nombre_mostrado: 'Chispa' });
  });

  it('falls back to nombre for rows written before the expand', () => {
    expect(toPokemonV3(legacy)).toEqual({ ...legacy, apodo: null, nombre_mostrado: 'Bulbasaur' });
  });
});

describe('parseApodo', () => {
  it('accepts missing, null and trimmed strings', () => {
    expect(parseApodo(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseApodo(null)).toEqual({ ok: true, value: null });
    expect(parseApodo('  Chispa ')).toEqual({ ok: true, value: 'Chispa' });
    expect(parseApodo('   ')).toEqual({ ok: true, value: null });
  });

  it('rejects non strings and values longer than the column', () => {
    expect(parseApodo(7).ok).toBe(false);
    expect(parseApodo('x'.repeat(51)).ok).toBe(false);
  });
});

describe('api/v3 pokemon', () => {
  it('lists old and new rows with nombre_mostrado', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [withApodo, legacy] }));
    const response = await app.inject({ method: 'GET', url: '/api/v3/pokemon' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-api-version']).toBe('v3');
    expect(response.json().map((row: { nombre_mostrado: string }) => row.nombre_mostrado)).toEqual([
      'Chispa',
      'Bulbasaur',
    ]);
  });

  it('stores the apodo on create', async () => {
    const client = createCrudClient({ data: withApodo });
    const app = await buildApp(mockEnv, client);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v3/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', nivel: 5, apodo: ' Chispa ' },
    });

    expect(response.statusCode).toBe(201);
    expect(insertedValues(client)).toEqual({ nombre: 'Pikachu', tipo: 'Electrico', nivel: 5, apodo: 'Chispa' });
    expect(response.json().nombre_mostrado).toBe('Chispa');
  });

  it('creates without apodo like v2 does', async () => {
    const client = createCrudClient({ data: legacy });
    const app = await buildApp(mockEnv, client);
    await app.inject({ method: 'POST', url: '/api/v3/pokemon', payload: { nombre: 'Bulbasaur', tipo: 'Planta' } });

    expect(insertedValues(client)).toEqual({ nombre: 'Bulbasaur', tipo: 'Planta', nivel: 1 });
  });

  it('rejects an apodo that does not fit', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: withApodo }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v3/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', apodo: 'x'.repeat(51) },
    });

    expect(response.statusCode).toBe(400);
  });

  it('clears the apodo on PUT when it is not sent', async () => {
    const client = createCrudClient({ data: legacy });
    const app = await buildApp(mockEnv, client);
    await app.inject({
      method: 'PUT',
      url: '/api/v3/pokemon/pokemon-2',
      payload: { nombre: 'Bulbasaur', tipo: 'Planta', nivel: 4 },
    });

    expect(insertedValues(client)).toEqual({ nombre: 'Bulbasaur', tipo: 'Planta', nivel: 4, apodo: null });
  });

  it('patches only the apodo', async () => {
    const client = createCrudClient({ data: withApodo });
    const app = await buildApp(mockEnv, client);
    const response = await app.inject({ method: 'PATCH', url: '/api/v3/pokemon/pokemon-1', payload: { apodo: 'Chispa' } });

    expect(response.statusCode).toBe(200);
    expect(insertedValues(client)).toEqual({ apodo: 'Chispa' });
  });

  it('rejects an empty patch', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: withApodo }));
    const response = await app.inject({ method: 'PATCH', url: '/api/v3/pokemon/pokemon-1', payload: {} });

    expect(response.statusCode).toBe(400);
  });

  it('returns the last pokemon with the v3 contract', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [legacy] }));
    const body = (await app.inject({ method: 'GET', url: '/api/v3/pokemon/last' })).json();

    expect(body.version).toBe('3.0.0');
    expect(body.local).toEqual({ ...legacy, apodo: null, nombre_mostrado: 'Bulbasaur' });
  });

  it('composes peers on getById with the v3 version', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'peer' }) }));
    const app = await buildApp(mockEnv, createCrudClient({ data: withApodo }), fetchImpl);
    const body = (await app.inject({ method: 'GET', url: '/api/v3/pokemon/pokemon-1' })).json();

    expect(body.version).toBe('3.0.0');
    expect(body.local.nombre_mostrado).toBe('Chispa');
  });
});

describe('api/v3 entrenador and batalla', () => {
  it('serves the same records under v3', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [{ id: 'e-1', nombre: 'Ash' }] }));

    expect((await app.inject({ method: 'GET', url: '/api/v3/entrenador' })).json()).toEqual([
      { id: 'e-1', nombre: 'Ash' },
    ]);
    expect((await app.inject({ method: 'GET', url: '/api/v3/batalla/last' })).json().version).toBe('3.0.0');
  });
});

describe('api/v2 and api/v3 coexist', () => {
  it('keeps v2 on 2.0.0 without the new fields', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [withApodo] }));
    const body = (await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' })).json();

    expect(body.version).toBe('2.0.0');
    expect(body.local).not.toHaveProperty('apodo');
    expect(body.local).not.toHaveProperty('nombre_mostrado');
  });
});
