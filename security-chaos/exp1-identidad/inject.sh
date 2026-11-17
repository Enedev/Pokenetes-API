#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then set -a; source "$ROOT/security-chaos/gameday.env"; set +a; fi
# shellcheck disable=SC1091
source "$ROOT/security-chaos/lib/gameday.sh"
export GD_EXP=exp1 GD_ROUND="${GD_ROUND:-0}" GD_RUN="${GD_RUN:-1}" GD_ACTOR="${GD_ACTOR:-neithan}"
export GD_TRACE="${GD_TRACE:-$(gd_new_trace 1 "$GD_ROUND" "$GD_RUN")}"
export GD_EVIDENCE="$ROOT/security-chaos/evidence/exp1/ronda-${GD_ROUND}"
mkdir -p "$GD_EVIDENCE"
region="${AWS_REGION:-us-east-1}"
role="${ROLE_NAME:-pokenetes-api-instance}"
secret="${SECRET_ID:-pokenetes/terraform}"

gd_check_stop
code=$(gd_canary_flow)
gd_log inject_start flujo "$code"

instance=$(aws ec2 describe-instances --region "$region" --filters Name=tag:Name,Values="${INSTANCE_NAME:-pokenetes-api-stable}" Name=instance-state-name,Values=running --query "Reservations[0].Instances[0].InstanceId" --output text)
cmd=$(aws ssm send-command --region "$region" --instance-ids "$instance" --document-name AWS-RunShellScript --parameters commands="TOKEN=\$(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 300'); curl -s -H \"X-aws-ec2-metadata-token: \$TOKEN\" http://169.254.169.254/latest/meta-data/iam/security-credentials/${role}" --query Command.CommandId --output text)
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 3
  status=$(aws ssm get-command-invocation --region "$region" --command-id "$cmd" --instance-id "$instance" --query Status --output text 2>/dev/null || echo Pending)
  [ "$status" = "Success" ] && break
done
raw=$(aws ssm get-command-invocation --region "$region" --command-id "$cmd" --instance-id "$instance" --query StandardOutputContent --output text)
creds=$(mktemp)
chmod 600 "$creds"
printf '%s' "$raw" >"$creds"
unset raw
python - "$creds" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
base = sys.argv[1]
open(base + ".ak", "w", encoding="utf-8").write(data["AccessKeyId"])
open(base + ".sk", "w", encoding="utf-8").write(data["SecretAccessKey"])
open(base + ".st", "w", encoding="utf-8").write(data["Token"])
PY

try_call() {
  local name="$1"
  shift
  gd_check_stop
  set +e
  out=$(env AWS_ACCESS_KEY_ID="$AK" AWS_SECRET_ACCESS_KEY="$SK" AWS_SESSION_TOKEN="$ST" AWS_DEFAULT_REGION="$region" "$@" 2>&1)
  rc=$?
  set -e
  if [ "$rc" = 0 ]; then
    gd_log inject_end "$name" permitida
  else
    if printf '%s' "$out" | grep -Eqi 'AccessDenied|UnauthorizedOperation|not authorized'; then
      gd_log inject_end "$name" denegada
    else
      gd_log inject_end "$name" error
    fi
  fi
}

AK=$(cat "$creds.ak")
SK=$(cat "$creds.sk")
ST=$(cat "$creds.st")
(
  try_call sts-identity aws sts get-caller-identity --output text >/dev/null
  try_call secreto-propio aws secretsmanager get-secret-value --secret-id "$secret" --query Name --output text >/dev/null
  ids=$(env AWS_ACCESS_KEY_ID="$AK" AWS_SECRET_ACCESS_KEY="$SK" AWS_SESSION_TOKEN="$ST" AWS_DEFAULT_REGION="$region" aws secretsmanager get-secret-value --secret-id "$secret" --query SecretString --output text 2>/dev/null | python -c "import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    d={}
vals=[str(d[k]) for k in d if k.endswith('_SECRET_ID') and d[k]]
print('\n'.join(vals))" || true)
  if [ -z "${ids:-}" ]; then
    gd_log inject_end senuelo "sin señuelo"
  else
    printf '%s\n' "$ids" | while IFS= read -r id; do
      [ -z "$id" ] && continue
      try_call senuelo aws secretsmanager get-secret-value --secret-id "$id" --query Name --output text >/dev/null
    done
  fi
  try_call iam-list-users aws iam list-users --output text >/dev/null
  try_call s3-ls aws s3 ls >/dev/null
  try_call ec2-describe aws ec2 describe-instances --output text >/dev/null
)
rm -f "$creds" "$creds.ak" "$creds.sk" "$creds.st"
unset AK SK ST
gd_log inject_end credenciales descartadas-del-subshell
