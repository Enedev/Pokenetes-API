import { afterEach, describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { configureEmf, emfLine, EMF_NAMESPACE } from '../src/metrics/emf';
import { isPokemonCreated } from '../src/metrics/requests';
import { sampleSaturation, startSaturationSampler } from '../src/metrics/saturation';
import { APP_VERSION, PUBLIC_API_VERSION } from '../src/config/version';
import { mockEnv, createCrudClient, createInsertClient } from './helpers';

function capture(): string[] {
  const lines: string[] = [];
  configureEmf({ enabled: true, sink: (line) => lines.push(line) });
  return lines;
}

afterEach(() => {
  configureEmf({ enabled: false, sink: () => undefined });
});

describe('emfLine', () => {
  it('declares the metrics under the canary namespace with the Track dimension', () => {
    const doc = JSON.parse(emfLine('canary', { Latency: { value: 12, unit: 'Milliseconds' } }, { route: '/x' }, 1000));

    expect(doc._aws.Timestamp).toBe(1000);
    expect(doc._aws.CloudWatchMetrics[0].Namespace).toBe(EMF_NAMESPACE);
    expect(doc._aws.CloudWatchMetrics[0].Dimensions).toEqual([['Track']]);
    expect(doc._aws.CloudWatchMetrics[0].Metrics).toEqual([{ Name: 'Latency', Unit: 'Milliseconds' }]);
    expect(doc).toMatchObject({ Track: 'canary', Version: APP_VERSION, route: '/x', Latency: 12 });
  });
});

describe('request metrics', () => {
  it('emits one line per request with latency and the status class', async () => {
    const lines = capture();
    const app = await buildApp(mockEnv, createCrudClient({ data: [] }));
    await app.inject({ method: 'GET', url: '/api/pokemon' });
    await app.inject({ method: 'GET', url: '/nope' });

    const docs = lines.map((line) => JSON.parse(line));
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ Track: 'stable', Requests: 1, Errors5xx: 0, Errors4xx: 0, api: PUBLIC_API_VERSION });
    expect(docs[0].Latency).toBeGreaterThanOrEqual(0);
    expect(docs[1]).toMatchObject({ Errors4xx: 1, status: 404 });
  });

  it('skips the health check', async () => {
    const lines = capture();
    const app = await buildApp(mockEnv);
    await app.inject({ method: 'GET', url: '/health' });

    expect(lines).toHaveLength(0);
  });

  it('counts created pokemon as the business metric', async () => {
    const lines = capture();
    const app = await buildApp({ ...mockEnv, APP_TRACK: 'canary' }, createInsertClient({ id: '1' }));
    await app.inject({
      method: 'POST',
      url: '/api/pokemon',
      payload: { nombre: 'Mew', tipo: 'Psiquico' },
    });

    const doc = JSON.parse(lines[0]);
    expect(doc.PokemonCreated).toBe(1);
    expect(doc.Track).toBe('canary');
  });

  it('stays silent when EMF is disabled', async () => {
    const lines: string[] = [];
    configureEmf({ enabled: false, sink: (line) => lines.push(line) });
    const app = await buildApp(mockEnv, createCrudClient({ data: [] }));
    await app.inject({ method: 'GET', url: '/api/pokemon' });

    expect(lines).toHaveLength(0);
  });
});

describe('isPokemonCreated', () => {
  it('only matches a successful POST on a pokemon collection', () => {
    expect(isPokemonCreated('POST', '/api/v2/pokemon', 201)).toBe(true);
    expect(isPokemonCreated('POST', '/pokemon', 201)).toBe(true);
    expect(isPokemonCreated('POST', '/api/v2/pokemon', 400)).toBe(false);
    expect(isPokemonCreated('GET', '/api/v2/pokemon', 201)).toBe(false);
    expect(isPokemonCreated('POST', '/api/v2/entrenador', 201)).toBe(false);
  });
});

describe('saturation', () => {
  it('turns CPU time into a percent of the elapsed time', () => {
    const sample = sampleSaturation(
      { cpu: { user: 0, system: 0 }, at: 0 },
      { cpu: { user: 250000, system: 250000 }, at: 1000 },
      { rss: 100 * 1024 * 1024, heapUsed: 50 * 1024 * 1024 } as NodeJS.MemoryUsage,
    );

    expect(sample.metrics.ProcessCpu.value).toBe(50);
    expect(sample.metrics.MemoryRss.value).toBe(100);
    expect(sample.metrics.HeapUsed.value).toBe(50);
  });

  it('emits samples on an unref timer', async () => {
    const lines = capture();
    const timer = startSaturationSampler('canary', 5);
    await new Promise((resolve) => setTimeout(resolve, 30));
    clearInterval(timer);

    expect(lines.length).toBeGreaterThan(0);
    expect(JSON.parse(lines[0]).Track).toBe('canary');
  });
});
