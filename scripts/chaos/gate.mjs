import { readFileSync } from 'node:fs';

const summaryPath = process.argv[2];
const profile = JSON.parse(readFileSync(new URL('../../chaos/profile.json', import.meta.url), 'utf8'));
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const duration = summary.metrics?.http_req_duration?.values ?? {};
const p95 = duration['p(95)'];
const failed = summary.metrics?.checks?.values?.rate;

const report = {
  metric: profile.metric,
  threshold_ms: profile.threshold_ms,
  p95_ms: p95,
  check_rate: failed,
  pass: typeof p95 === 'number' && p95 < profile.threshold_ms,
};

console.log(JSON.stringify(report));
if (!report.pass) {
  console.error(`chaos gate failed: p95 ${p95} ms is not under ${profile.threshold_ms} ms`);
  process.exit(1);
}
