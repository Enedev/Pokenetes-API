#!/usr/bin/env bash
set -euo pipefail
count="${1:?uso: seed.sh <N> <R>}"
round="${2:?uso: seed.sh <N> <R>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then set -a; source "$ROOT/security-chaos/gameday.env"; set +a; fi
base="${COORDINATOR_URL:?}/api/v5/flujo"
dir="$ROOT/security-chaos/evidence/exp4/ronda-${round}"
mkdir -p "$dir"
manifest="$dir/manifest.json"
if [ ! -f "$manifest" ]; then echo '[]' >"$manifest"; fi
python - "$count" "$round" "$base" "$manifest" <<'PY'
import json, sys, uuid, urllib.request
from datetime import datetime, timezone
count, round_, base, path = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
rows = json.load(open(path, encoding="utf-8"))
for i in range(1, count + 1):
    trace = f"gd4-r{round_}-{i}-{uuid.uuid4()}"
    code = 0
    for _ in range(2):
        req = urllib.request.Request(base, headers={"x-trace-id": trace})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                code = resp.status
        except Exception:
            code = 0
        if code == 200:
            break
    rows.append({"trace_id": trace, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "http": code})
json.dump(rows, open(path, "w", encoding="utf-8"), indent=2)
print(f"manifest {path} entries {len(rows)}")
PY
