import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), 'utf8'));
}

export const loadSlo = () => readJson('canary/slo.json');
export const loadStages = () => readJson('canary/stages.json');

export function aws(args) {
  const out = execFileSync('aws', [...args, '--output', 'json'], { encoding: 'utf8' });
  return out.trim() ? JSON.parse(out) : {};
}

let cachedOutputs;

export function outputs() {
  if (cachedOutputs) return cachedOutputs;

  const file = process.env.CANARY_OUTPUTS;
  const raw = file && existsSync(file)
    ? readFileSync(file, 'utf8')
    : execFileSync('terraform', [`-chdir=${resolve(ROOT, 'terraform')}`, 'output', '-json'], { encoding: 'utf8' });
  const parsed = JSON.parse(raw);
  const value = (key) => parsed[key]?.value;

  cachedOutputs = {
    apiUrl: process.env.API_URL ?? value('api_url'),
    listenerArn: value('listener_arn'),
    targetGroups: value('target_group_arns'),
    lbDimension: value('load_balancer_dimension'),
    tgDimensions: value('target_group_dimensions'),
    alarms: value('abort_alarms') ?? [],
    region: process.env.AWS_REGION ?? 'us-east-1',
  };
  return cachedOutputs;
}

export function currentWeights() {
  const { listenerArn, targetGroups } = outputs();
  const { Listeners } = aws(['elbv2', 'describe-listeners', '--listener-arns', listenerArn]);
  const forward = Listeners[0].DefaultActions.find((action) => action.Type === 'forward').ForwardConfig;
  const weightOf = (arn) => forward.TargetGroups.find((tg) => tg.TargetGroupArn === arn)?.Weight ?? 0;

  return {
    stable: weightOf(targetGroups.stable),
    canary: weightOf(targetGroups.canary),
    stickiness: forward.TargetGroupStickinessConfig ?? { Enabled: false },
  };
}

export function setCanaryWeight(canaryWeight) {
  const weight = Math.round(Number(canaryWeight));
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    throw new Error(`invalid canary weight: ${canaryWeight}`);
  }

  const { listenerArn, targetGroups } = outputs();
  const { stickiness } = currentWeights();
  const actions = [
    {
      Type: 'forward',
      ForwardConfig: {
        TargetGroups: [
          { TargetGroupArn: targetGroups.stable, Weight: 100 - weight },
          { TargetGroupArn: targetGroups.canary, Weight: weight },
        ],
        TargetGroupStickinessConfig: stickiness,
      },
    },
  ];

  const file = join(tmpdir(), `canary-actions-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(actions));
  aws(['elbv2', 'modify-listener', '--listener-arn', listenerArn, '--default-actions', `file://${file}`]);
  return { stable: 100 - weight, canary: weight };
}

export function alarmStates() {
  const { alarms } = outputs();
  if (alarms.length === 0) return [];
  const { MetricAlarms } = aws(['cloudwatch', 'describe-alarms', '--alarm-names', ...alarms]);
  return MetricAlarms.map((alarm) => ({ name: alarm.AlarmName, state: alarm.StateValue }));
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function log(event, data = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
