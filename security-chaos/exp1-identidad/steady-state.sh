#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then set -a; source "$ROOT/security-chaos/gameday.env"; set +a; fi
# shellcheck disable=SC1091
source "$ROOT/security-chaos/lib/gameday.sh"
export GD_EXP=exp1 GD_ROUND=0 GD_RUN=0 GD_ACTOR="${GD_ACTOR:-neithan}"
export GD_TRACE="$(gd_new_trace 1 0 0)"
export GD_EVIDENCE="$ROOT/security-chaos/evidence/exp1"
mkdir -p "$GD_EVIDENCE"
region="${AWS_REGION:-us-east-1}"
out="$GD_EVIDENCE/estado-estable.json"

clock="no-medido"
if command -v w32tm >/dev/null 2>&1; then
  clock=$(cmd.exe //c "w32tm /stripchart /computer:time.google.com /samples:1 /dataonly" 2>&1 | tr '\n' ' ' || true)
fi

flow=$(curl -s -o /dev/null -w '%{http_code}' -H "x-trace-id: $GD_TRACE" "${COORDINATOR_URL}/api/v5/flujo" || echo 000)
trails=$(aws cloudtrail describe-trails --region "$region" --output json 2>/dev/null || echo '{"error":"describe-trails"}')
alarms=$(aws cloudwatch describe-alarms --region "$region" --alarm-name-prefix pokenetes --output json 2>/dev/null || echo '{"error":"describe-alarms"}')
policies=$(aws iam list-role-policies --role-name "${ROLE_NAME:-pokenetes-api-instance}" --output json 2>/dev/null || echo '{"error":"list-role-policies"}')
attached=$(aws iam list-attached-role-policies --role-name "${ROLE_NAME:-pokenetes-api-instance}" --output json 2>/dev/null || echo '{"error":"list-attached"}')
ids=$(aws ec2 describe-instances --region "$region" --filters Name=tag:Name,Values="${INSTANCE_NAME:-pokenetes-api-stable}" --query "Reservations[].Instances[].{Id:InstanceId,Metadata:MetadataOptions}" --output json 2>/dev/null || echo '[]')
summary=$(aws iam get-account-summary --output json 2>/dev/null || echo '{"error":"get-account-summary"}')
if command -v gh >/dev/null 2>&1; then
  secrets=$(gh secret list --repo Enedev/Pokenetes-API 2>&1 || true)
else
  secrets="gh no instalado"
fi

TRAILS="$trails" ALARMS="$alarms" POLICIES="$policies" ATTACHED="$attached" IDS="$ids" SUMMARY="$summary" FLOW="$flow" CLOCK="$clock" SECRETS="$secrets" TRACE="$GD_TRACE" python - <<'PY' >"$out"
import json, os
def load(name):
    raw = os.environ.get(name, "")
    try:
        return json.loads(raw)
    except Exception:
        return raw
summary = load("SUMMARY")
keys = None
if isinstance(summary, dict):
    keys = summary.get("SummaryMap", {}).get("AccountAccessKeysPresent")
print(json.dumps({
    "captured_at": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "trace_id": os.environ["TRACE"],
    "flow_http": os.environ["FLOW"],
    "clock_skew": os.environ["CLOCK"],
    "trails": load("TRAILS"),
    "alarms": load("ALARMS"),
    "role_inline_policies": load("POLICIES"),
    "role_attached_policies": load("ATTACHED"),
    "stable_metadata": load("IDS"),
    "account_access_keys_present": keys,
    "gh_secret_list": os.environ["SECRETS"],
}, indent=2))
PY
echo "wrote $out"
