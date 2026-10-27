import {
  DescribeListenersCommand,
  ElasticLoadBalancingV2Client,
  ModifyListenerCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';

const client = new ElasticLoadBalancingV2Client({});

export function rollbackAction(stableArn, canaryArn, stickiness) {
  return [
    {
      Type: 'forward',
      ForwardConfig: {
        TargetGroups: [
          { TargetGroupArn: stableArn, Weight: 100 },
          { TargetGroupArn: canaryArn, Weight: 0 },
        ],
        TargetGroupStickinessConfig: stickiness ?? { Enabled: false },
      },
    },
  ];
}

export const handler = async (event) => {
  const { LISTENER_ARN, STABLE_TG_ARN, CANARY_TG_ARN } = process.env;
  const alarm = event?.detail?.alarmName ?? 'manual';
  const reason = event?.detail?.state?.reason ?? 'manual invocation';

  const { Listeners } = await client.send(new DescribeListenersCommand({ ListenerArns: [LISTENER_ARN] }));
  const forward = Listeners?.[0]?.DefaultActions?.find((action) => action.Type === 'forward')?.ForwardConfig;
  const before = Object.fromEntries((forward?.TargetGroups ?? []).map((tg) => [tg.TargetGroupArn, tg.Weight]));

  await client.send(
    new ModifyListenerCommand({
      ListenerArn: LISTENER_ARN,
      DefaultActions: rollbackAction(STABLE_TG_ARN, CANARY_TG_ARN, forward?.TargetGroupStickinessConfig),
    }),
  );

  const result = {
    action: 'rollback',
    alarm,
    reason,
    canary_weight_before: before[CANARY_TG_ARN] ?? null,
    canary_weight_after: 0,
    at: new Date().toISOString(),
  };
  console.log(JSON.stringify(result));
  return result;
};
