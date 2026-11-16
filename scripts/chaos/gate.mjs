import { readFileSync } from 'node:fs';

const summaryPath = process.argv[2];
const profile = JSON.parse(readFileSync(new URL('../../chaos/profile.json', import.meta.url), 'utf8'));
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const faultPhase = summary.phases?.fault?.latencyMs?.p95;
const tagged = summary.metrics?.['http_req_duration{phase:fault}']?.values?.['p(95)'];
const legacy = summary.metrics?.fault_window_duration?.values?.['p(95)']
  ?? summary.metrics?.http_req_duration?.values?.['p(95)'];
const p95 = faultPhase ?? tagged ?? legacy;

const report = {
  metric: 'http_req_duration{phase:fault}',
  threshold_ms: profile.threshold_ms,
  p95_ms: p95,
  requests: summary.phases?.fault?.requests ?? null,
  pass: typeof p95 === 'number' && p95 <= profile.threshold_ms,
};

console.log(JSON.stringify(report));
if (!report.pass) {
  console.error(`chaos gate failed: fault-window p95 ${p95} ms is not at or under ${profile.threshold_ms} ms`);
  process.exit(1);
}
