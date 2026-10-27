import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { resolveTrack } from '../src/config/release';
import { APP_VERSION } from '../src/config/version';
import { apiVersionOf } from '../src/http/release';
import { mockEnv, createCrudClient } from './helpers';

describe('resolveTrack', () => {
  it('defaults to stable', () => {
    expect(resolveTrack(undefined)).toBe('stable');
    expect(resolveTrack('anything')).toBe('stable');
  });

  it('accepts canary in any case', () => {
    expect(resolveTrack(' Canary ')).toBe('canary');
  });
});

describe('apiVersionOf', () => {
  it('reads the explicit prefix', () => {
    expect(apiVersionOf('/api/v2/pokemon/last')).toBe('v2');
    expect(apiVersionOf('/api/v3/pokemon?x=1')).toBe('v3');
  });

  it('maps the versionless prefix to the public version', () => {
    expect(apiVersionOf('/api/pokemon')).toMatch(/^v\d+$/);
  });

  it('treats the root routes as v1', () => {
    expect(apiVersionOf('/pokemon')).toBe('v1');
    expect(apiVersionOf('/health')).toBe('v1');
  });
});

describe('release headers', () => {
  it('tags every response with the build version and the stable track', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [] }));
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon' });

    expect(response.headers['x-app-version']).toBe(APP_VERSION);
    expect(response.headers['x-app-track']).toBe('stable');
    expect(response.headers['x-api-version']).toBe('v2');
  });

  it('reports the canary track when APP_TRACK is canary', async () => {
    const app = await buildApp({ ...mockEnv, APP_TRACK: 'canary' });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-app-track']).toBe('canary');
  });

  it('tags error responses too', async () => {
    const app = await buildApp(mockEnv);
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-app-version']).toBe(APP_VERSION);
    expect(response.headers['x-app-track']).toBe('stable');
  });
});
