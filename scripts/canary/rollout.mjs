import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { alarmStates, currentWeights, loadSlo, loadStages, log, outputs, ROOT, setCanaryWeight, sleep } from './lib.mjs';
import { runLoad } from './load.mjs';
import { decide } from './stats.mjs';
import { setFault } from './fault.mjs';

function arg(name) {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
}

const slo = loadSlo();
const { load, stages } = loadStages();
const { apiUrl } = outputs();
const faultAt = arg('fault-at');
const faultRate = Number(arg('fault-error-rate') ?? 0.3);
const faultLatency = arg('fault-latency-ms');
const onlyStage = arg('only');
const report = { started_at: new Date().toISOString(), api_url: apiUrl, stages: [] };

function save() {
  const dir = join(ROOT, 'canary', 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `rollout-${report.started_at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

async function abort(stage, reason, details = {}) {
  const after = setCanaryWeight(0);
  await setFault(apiUrl, undefined).catch(() => undefined);
  report.result = { outcome: 'rolled_back', stage: stage.name, reason, weights: after, ...details };
  log('rollout.aborted', report.result);
  log('rollout.report', { file: save() });
  process.exit(1);
}

async function waitForAlarmsOk() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const firing = alarmStates().filter((alarm) => alarm.state === 'ALARM');
    if (firing.length === 0) return;
    log('rollout.waiting_alarms', { firing });
    await sleep(15_000);
  }
  throw new Error('abort alarms are still firing; fix the canary before a new rollout');
}

async function bake(stage, seconds) {
  let firing = [];
  const result = await runLoad({
    baseUrl: apiUrl,
    durationSeconds: seconds,
    concurrency: load.concurrency,
    mix: load.mix,
    canaryHeaderShare: stage.canary_header_share ?? 0,
    onProgress: (byTrack, total) => {
      firing = alarmStates().filter((alarm) => alarm.state === 'ALARM');
      log('rollout.bake', { stage: stage.name, total, byTrack, firing });
    },
  });
  return { ...result, firing };
}

await waitForAlarmsOk();
log('rollout.start', { apiUrl, weights: currentWeights(), stages: stages.map((stage) => `${stage.name}:${stage.weight}%`) });

for (const stage of stages) {
  if (onlyStage && stage.name !== onlyStage) continue;

  const weights = setCanaryWeight(stage.weight);
  log('rollout.stage', { stage: stage.name, weights, bake_seconds: stage.bake_seconds });

  if (faultAt === stage.name) {
    const fault = faultLatency ? { latency_ms: Number(faultLatency) } : { error_rate: faultRate };
    log('rollout.fault_injected', await setFault(apiUrl, fault));
  }

  let outcome = await bake(stage, stage.bake_seconds);
  let verdict = decide(slo, outcome.byTrack.canary, outcome.byTrack.stable);

  if (verdict.decision === 'pause' && outcome.firing.length === 0) {
    log('rollout.paused', { stage: stage.name, verdict });
    outcome = await bake(stage, Math.ceil(stage.bake_seconds / 2));
    verdict = decide(slo, outcome.byTrack.canary, outcome.byTrack.stable);
  }

  const total = outcome.samples.length;
  const observedShare = total === 0 ? 0 : (100 * outcome.byTrack.canary.n) / total;
  report.stages.push({
    stage: stage.name,
    weight: stage.weight,
    observed_canary_share_pct: Number(observedShare.toFixed(2)),
    stable: outcome.byTrack.stable,
    canary: outcome.byTrack.canary,
    verdict,
    firing: outcome.firing,
  });
  log('rollout.verdict', report.stages.at(-1));

  if (outcome.firing.length > 0) await abort(stage, 'cloudwatch alarm', { firing: outcome.firing });
  if (verdict.decision === 'abort') await abort(stage, 'slo gate', { checks: verdict.checks });
  if (verdict.decision === 'pause') {
    report.result = { outcome: 'paused', stage: stage.name, weights };
    log('rollout.held', report.result);
    log('rollout.report', { file: save() });
    process.exit(2);
  }
}

report.result = { outcome: onlyStage ? 'stage_passed' : 'promoted', weights: currentWeights() };
log('rollout.done', report.result);
log('rollout.report', { file: save() });
