import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const profile = JSON.parse(readFileSync(new URL('../../chaos/profile.json', import.meta.url), 'utf8'));
const round = process.argv[2] === '1' ? '1' : process.argv[2] === 'cal' ? 'cal' : '0';
const apiUrl = (process.env.API_URL ?? 'http://pokenetes-alb-1190353326.us-east-1.elb.amazonaws.com').replace(/\/$/, '');
const resilience = round === '1';
const injectFault = round !== 'cal';
const samples = [];
const started = Date.now();
let running = 0;
let stop = false;

function seconds(value) {
  return Number(String(value).replace('s', ''));
}

function targetAt(elapsed) {
  let cursor = 0;
  let current = profile.startVUs;
  for (const stage of profile.stages) {
    const length = seconds(stage.duration);
    if (elapsed <= cursor + length) {
      const ratio = length === 0 ? 1 : (elapsed - cursor) / length;
      return Math.max(0, Math.round(current + (stage.target - current) * ratio));
    }
    cursor += length;
    current = stage.target;
  }
  return 0;
}

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function oneRequest(id) {
  const elapsed = (Date.now() - started) / 1000;
  const inFault = elapsed >= profile.faultWindow.startSeconds
    && elapsed < profile.faultWindow.startSeconds + profile.faultWindow.durationSeconds;
  const headers = { 'x-trace-id': `round${round}-${id}-${Date.now()}` };
  if (inFault && injectFault) headers['x-peer-latency-ms'] = String(profile.latency_ms);
  if (resilience) headers['x-peer-resilience'] = 'true';
  const t0 = Date.now();
  let status = 0;
  try {
    const response = await fetch(`${apiUrl}${profile.entry}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    await response.arrayBuffer();
  } catch {
    status = 0;
  }
  if (inFault) samples.push({ duration: Date.now() - t0, status });
}

async function worker(id) {
  while (!stop) {
    await oneRequest(id);
    await new Promise((resolve) => setTimeout(resolve, profile.thinkTimeSeconds * 1000));
  }
}

const workers = [];
const total = profile.stages.reduce((sum, stage) => sum + seconds(stage.duration), 0);
const timer = setInterval(() => {
  const elapsed = (Date.now() - started) / 1000;
  const desired = elapsed >= total ? 0 : targetAt(elapsed);
  while (workers.length < desired) workers.push(worker(workers.length + 1));
  if (elapsed >= total && running === 0) {
    stop = true;
    clearInterval(timer);
  }
  process.stdout.write(`\rround=${round} t=${Math.round(elapsed)}s vus=${workers.length} fault_samples=${samples.length}`);
}, 1000);

await new Promise((resolve) => {
  const done = setInterval(() => {
    if (stop) {
      clearInterval(done);
      resolve();
    }
  }, 1000);
});

const durations = samples.map((sample) => sample.duration);
const successes = samples.filter((sample) => sample.status === 200).length;
const p95 = percentile(durations, 0.95);
const report = {
  round,
  profile: profile.name,
  resilience,
  entry: profile.entry,
  fault_samples: samples.length,
  success_rate: samples.length === 0 ? 0 : successes / samples.length,
  p95_ms: p95,
  threshold_ms: profile.threshold_ms,
  hypothesis: round === 'cal'
    ? (p95 !== null && p95 < profile.threshold_ms ? 'estado_estable' : 'inestable')
    : (p95 !== null && p95 < profile.threshold_ms ? 'cumplida' : 'refutada'),
};
mkdirSync(new URL('../../chaos/reports/', import.meta.url), { recursive: true });
const file = new URL(`../../chaos/reports/round-${round}.json`, import.meta.url);
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`\n${JSON.stringify(report)}`);
