import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { aws, loadSlo, log, outputs } from './lib.mjs';
import { decide } from './stats.mjs';

const STATS = [
  { id: 'requests', metric: 'RequestCount', stat: 'Sum' },
  { id: 'errors5xx', metric: 'HTTPCode_Target_5XX_Count', stat: 'Sum' },
  { id: 'errors4xx', metric: 'HTTPCode_Target_4XX_Count', stat: 'Sum' },
  { id: 'p50', metric: 'TargetResponseTime', stat: 'p50' },
  { id: 'p95', metric: 'TargetResponseTime', stat: 'p95' },
  { id: 'p99', metric: 'TargetResponseTime', stat: 'p99' },
];

export function metricQueries(lbDimension, tgDimensions, periodSeconds) {
  return Object.entries(tgDimensions).flatMap(([track, tg]) =>
    STATS.map(({ id, metric, stat }) => ({
      Id: `${track}_${id}`,
      MetricStat: {
        Metric: {
          Namespace: 'AWS/ApplicationELB',
          MetricName: metric,
          Dimensions: [
            { Name: 'LoadBalancer', Value: lbDimension },
            { Name: 'TargetGroup', Value: tg },
          ],
        },
        Period: periodSeconds,
        Stat: stat,
      },
    })),
  );
}

export function toTrackSummary(results, track) {
  const value = (id) => results.find((result) => result.Id === `${track}_${id}`)?.Values?.[0];
  const n = value('requests') ?? 0;
  const errors5xx = value('errors5xx') ?? 0;
  const seconds = (id) => (value(id) === undefined ? null : value(id) * 1000);

  return {
    n,
    errors5xx,
    errors4xx: value('errors4xx') ?? 0,
    error_rate_pct: n === 0 ? 0 : (100 * errors5xx) / n,
    p50_ms: seconds('p50'),
    p95_ms: seconds('p95'),
    p99_ms: seconds('p99'),
  };
}

// Whole minutes inside the bake only, so traffic from the previous weight never leaks in.
export function alignWindow(startMs, endMs) {
  let start = Math.ceil(startMs / 60_000) * 60_000;
  const end = Math.floor(endMs / 60_000) * 60_000;
  if (end <= start) start = end - 60_000;
  return { start: new Date(start), end: new Date(end), period: (end - start) / 1000 };
}

export function analyzeCloudWatch(minutes = 5) {
  const now = Date.now();
  return analyzeWindow(now - minutes * 60_000, now);
}

export function analyzeWindow(startMs, endMs) {
  const { lbDimension, tgDimensions } = outputs();
  const { start, end, period } = alignWindow(startMs, endMs);
  const minutes = period / 60;
  const file = join(tmpdir(), `canary-queries-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(metricQueries(lbDimension, tgDimensions, period)));

  const { MetricDataResults } = aws([
    'cloudwatch',
    'get-metric-data',
    '--metric-data-queries',
    `file://${file}`,
    '--start-time',
    start.toISOString(),
    '--end-time',
    end.toISOString(),
  ]);

  const stable = toTrackSummary(MetricDataResults, 'stable');
  const canary = toTrackSummary(MetricDataResults, 'canary');
  return {
    source: 'cloudwatch',
    window: { start: start.toISOString(), end: end.toISOString(), minutes },
    stable,
    canary,
    verdict: decide(loadSlo(), canary, stable),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const minutes = Number(process.argv.find((value) => value.startsWith('--minutes='))?.slice(10) ?? 5);
  const result = analyzeCloudWatch(minutes);
  log('analyze', result);
  if (result.verdict.decision === 'abort') process.exitCode = 1;
}
