#!/usr/bin/env bash
gd_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

gd_new_trace() {
  local uuid
  uuid=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || powershell.exe -NoProfile -Command "[guid]::NewGuid().ToString()" | tr -d '\r')
  echo "gd-e$1-r$2-n$3-${uuid}"
}

gd_cloud_marker() {
  local line group stream region token ts
  line=$(cat)
  group="${GD_LOG_GROUP:-/pokenetes/gameday}"
  stream="${GD_LOG_STREAM:-neithan}"
  region="${AWS_REGION:-us-east-1}"
  aws logs create-log-stream --region "$region" --log-group-name "$group" --log-stream-name "$stream" >/dev/null 2>&1 || true
  token=$(aws logs describe-log-streams --region "$region" --log-group-name "$group" --log-stream-name-prefix "$stream" --query "logStreams[?logStreamName=='${stream}'].uploadSequenceToken | [0]" --output text 2>/dev/null || true)
  ts=$(($(date +%s) * 1000))
  GD_MARKER_LINE="$line" GD_MARKER_TS="$ts" python - <<'PY' >"${GD_EVIDENCE:-.}/.marker.json"
import json, os
print(json.dumps([{"timestamp": int(os.environ["GD_MARKER_TS"]), "message": os.environ["GD_MARKER_LINE"]}]))
PY
  if [ -n "$token" ] && [ "$token" != "None" ] && [ "$token" != "null" ]; then
    aws logs put-log-events --region "$region" --log-group-name "$group" --log-stream-name "$stream" --sequence-token "$token" --log-events "file://${GD_EVIDENCE:-.}/.marker.json" >/dev/null 2>&1 || true
  else
    aws logs put-log-events --region "$region" --log-group-name "$group" --log-stream-name "$stream" --log-events "file://${GD_EVIDENCE:-.}/.marker.json" >/dev/null 2>&1 || true
  fi
  rm -f "${GD_EVIDENCE:-.}/.marker.json"
}

gd_log() {
  mkdir -p "$GD_EVIDENCE"
  printf '{"ts":"%s","gameday_id":"gd-2026-11-17","experiment":"%s","round":%s,"run":%s,"phase":"%s","trace_id":"%s","actor":"%s","action":"%s","result":"%s"}\n' \
    "$(gd_now)" "$GD_EXP" "$GD_ROUND" "$GD_RUN" "$1" "$GD_TRACE" "$GD_ACTOR" "$2" "$3" | tee -a "$GD_EVIDENCE/bitacora.jsonl" | gd_cloud_marker
}

gd_canary_flow() {
  curl -s -o /dev/null -w '%{http_code}' -H "x-trace-id: $GD_TRACE" "$COORDINATOR_URL/api/v5/flujo"
}

gd_check_stop() {
  if [ -f security-chaos/STOP ] || [ "${GAMEDAY_STOP:-0}" = 1 ]; then
    gd_log aborted stop_switch triggered
    ./rollback.sh
    exit 99
  fi
}
