import { pathToFileURL } from 'node:url';
import { loadStages, outputs, log } from './lib.mjs';
import { summarize } from './stats.mjs';

export function pickWeighted(mix, random = Math.random) {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of mix) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return mix[mix.length - 1];
}

export function groupByTrack(samples) {
  const groups = { stable: [], canary: [] };
  for (const sample of samples) (groups[sample.track] ??= []).push(sample);
  return Object.fromEntries(Object.entries(groups).map(([track, list]) => [track, summarize(list)]));
}

async function hit(baseUrl, entry, headers, timeoutMs) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${entry.path}`, {
      method: entry.method,
      headers: { 'content-type': 'application/json', ...headers },
      body: entry.body ? JSON.stringify(entry.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    return {
      status: response.status,
      ms: performance.now() - started,
      track: response.headers.get('x-app-track') ?? 'unknown',
      version: response.headers.get('x-app-version') ?? 'unknown',
    };
  } catch {
    return { status: 0, ms: performance.now() - started, track: headers['x-canary'] ? 'canary' : 'unknown', version: 'unknown' };
  }
}

export async function runLoad({
  baseUrl,
  durationSeconds,
  concurrency,
  mix,
  canaryHeaderShare = 0,
  extraHeaders = {},
  timeoutMs = 10_000,
  onProgress,
}) {
  const deadline = Date.now() + durationSeconds * 1000;
  const samples = [];

  const worker = async () => {
    while (Date.now() < deadline) {
      const headers = { ...extraHeaders };
      if (Math.random() < canaryHeaderShare) headers['x-canary'] = 'true';
      samples.push(await hit(baseUrl, pickWeighted(mix), headers, timeoutMs));
    }
  };

  const ticker = onProgress ? setInterval(() => onProgress(groupByTrack(samples), samples.length), 15_000) : undefined;
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (ticker) clearInterval(ticker);

  return { samples, byTrack: groupByTrack(samples) };
}

function arg(name, fallback) {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { load } = loadStages();
  const baseUrl = arg('url') ?? outputs().apiUrl;
  const extraHeaders = {};
  if (arg('fault-error-rate')) extraHeaders['x-fault-error-rate'] = arg('fault-error-rate');
  if (arg('fault-latency-ms')) extraHeaders['x-fault-latency-ms'] = arg('fault-latency-ms');
  if (process.env.FAULT_TOKEN) extraHeaders['x-fault-token'] = process.env.FAULT_TOKEN;

  const result = await runLoad({
    baseUrl,
    durationSeconds: Number(arg('seconds', '60')),
    concurrency: Number(arg('concurrency', String(load.concurrency))),
    mix: load.mix,
    canaryHeaderShare: Number(arg('canary-share', '0')),
    extraHeaders,
    onProgress: (byTrack, total) => log('load.progress', { total, byTrack }),
  });

  const total = result.samples.length;
  const canaryShare = total === 0 ? 0 : (100 * (result.byTrack.canary?.n ?? 0)) / total;
  log('load.done', { baseUrl, total, canary_share_pct: Number(canaryShare.toFixed(2)), byTrack: result.byTrack });
}
