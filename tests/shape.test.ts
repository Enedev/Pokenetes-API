import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { applyShape, pickColumns } from '../src/routes/shape';
import { mockEnv, createCrudClient, createInsertClient } from './helpers';

const expanded = {
  id: 'pokemon-1',
  nombre: 'Pikachu',
  tipo: 'Electrico',
  nivel: 5,
  created_at: '2026-10-27T00:00:00.000Z',
  apodo: 'Chispa',
};

const v2Only = {
  id: 'pokemon-1',
  nombre: 'Pikachu',
  tipo: 'Electrico',
  nivel: 5,
  created_at: '2026-10-27T00:00:00.000Z',
};

describe('pickColumns', () => {
  it('keeps only the listed columns that exist', () => {
    expect(pickColumns(['id', 'nombre', 'missing'])({ id: 1, nombre: 'a', extra: true })).toEqual({
      id: 1,
      nombre: 'a',
    });
  });
});

describe('applyShape', () => {
  const shape = pickColumns(['id']);

  it('maps arrays and objects', () => {
    expect(applyShape([{ id: 1, x: 2 }], shape)).toEqual([{ id: 1 }]);
    expect(applyShape({ id: 1, x: 2 }, shape)).toEqual({ id: 1 });
  });

  it('passes through empty values and missing shapes', () => {
    expect(applyShape(null, shape)).toBeNull();
    expect(applyShape(undefined, shape)).toBeUndefined();
    expect(applyShape({ id: 1, x: 2 }, undefined)).toEqual({ id: 1, x: 2 });
    expect(applyShape('text', shape)).toBe('text');
  });
});

describe('api/v2 keeps its pokemon contract after the schema expands', () => {
  it('drops columns added later from the list', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [expanded] }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon' });

    expect(response.json()).toEqual([v2Only]);
  });

  it('drops columns added later from last', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [expanded] }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' });

    expect(response.json().local).toEqual(v2Only);
  });

  it('drops columns added later from the created record', async () => {
    const app = await buildApp(mockEnv, createInsertClient(expanded));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', nivel: 5, apodo: 'Chispa' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(v2Only);
  });
});
