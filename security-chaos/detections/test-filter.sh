#!/usr/bin/env bash
set -euo pipefail
name="$1"
expect="$2"
root="$(cd "$(dirname "$0")" && pwd)"
case "$name" in
  gd1-role-secret-outside-vpce)
    pattern='{ ($.eventSource = "secretsmanager.amazonaws.com") && ($.eventName = "GetSecretValue") && ($.userIdentity.sessionContext.sessionIssuer.userName = "pokenetes-api-instance") && ($.vpcEndpointId NOT EXISTS) }'
    ;;
  gd1-honeytoken-touched)
    pattern='{ ($.eventSource = "secretsmanager.amazonaws.com") && ($.eventName = "GetSecretValue") && ($.requestParameters.secretId = "*backup-admin*") }'
    ;;
  *)
    echo "regla desconocida" >&2
    exit 2
    ;;
esac
message=$(cat "$root/$name/fixtures/${expect}.json")
result=$(aws logs test-metric-filter --region us-east-1 --filter-pattern "$pattern" --log-event-messages "$message")
printf '%s\n' "$result" >"$root/$name/last-run-${expect}.log"
count=$(printf '%s' "$result" | python -c "import json,sys; print(len(json.load(sys.stdin).get('matches', [])))")
if [ "$expect" = "positive" ] && [ "$count" = "0" ]; then
  echo "$name no disparo" >&2
  exit 1
fi
if [ "$expect" = "negative" ] && [ "$count" != "0" ]; then
  echo "$name disparo con trafico que no debia" >&2
  exit 1
fi
echo "$name $expect ok"
