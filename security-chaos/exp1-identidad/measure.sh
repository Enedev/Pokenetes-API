#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then set -a; source "$ROOT/security-chaos/gameday.env"; set +a; fi
round="${GD_ROUND:-0}"
evidence="$ROOT/security-chaos/evidence/exp1/ronda-${round}"
mkdir -p "$evidence"
region="${AWS_REGION:-us-east-1}"
history=$(aws cloudwatch describe-alarm-history --region "$region" --alarm-name-prefix gd1- --max-records 20 --output json 2>/dev/null || echo '{"AlarmHistoryItems":[]}')
bitacora="$evidence/bitacora.jsonl"
HISTORY="$history" BITACORA="$bitacora" ROUND="$round" python - <<'PY' >"$evidence/results.json"
import json, os
from datetime import datetime
history = json.loads(os.environ["HISTORY"])
items = history.get("AlarmHistoryItems", [])
detect = None
for item in items:
    if item.get("HistorySummary", "").find("OK to ALARM") >= 0 or item.get("HistoryData", "").find("ALARM") >= 0:
        detect = item.get("Timestamp")
        break
t0 = None
contain = None
path = os.environ["BITACORA"]
if os.path.exists(path):
    for line in open(path, encoding="utf-8"):
        row = json.loads(line)
        if row.get("phase") == "inject_start" and t0 is None:
            t0 = row["ts"]
        if row.get("result") == "denegada" and contain is None:
            contain = row["ts"]
def parse(value):
    if not value:
        return None
    return datetime.strptime(value.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
mttd = mttc = None
if t0 and detect:
    mttd = int((parse(detect) - parse(t0)).total_seconds())
if t0 and contain:
    mttc = int((parse(contain) - parse(t0)).total_seconds())
print(json.dumps({
    "experiment": "exp1",
    "round": int(os.environ["ROUND"]),
    "run": 1,
    "trace_id": None,
    "t0": t0,
    "t_detect": detect,
    "t_contain": contain,
    "t_rollback_done": None,
    "mttd_s": mttd,
    "mttc_s": mttc,
    "techniques_emulated": ["T1552.005", "T1078.004", "T1555.006", "T1580"],
    "techniques_detected": [],
    "alerts_fired": [item.get("AlarmName") for item in items],
    "false_positives": None,
    "hypothesis_result": "refutada" if detect is None else "cumplida",
    "notes": "sin alarma en la ventana" if detect is None else "alarma registrada",
}, indent=2))
PY
echo "wrote $evidence/results.json"
