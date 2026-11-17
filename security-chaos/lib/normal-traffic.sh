#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/security-chaos/gameday.env"
  set +a
fi
minutes="${1:-1}"
end=$((SECONDS + minutes * 60))
while [ "$SECONDS" -lt "$end" ]; do
  trace="normal-$(date -u +%H%M%S)-$RANDOM"
  curl -s -o /dev/null -H "x-trace-id: $trace" "$COORDINATOR_URL/api/v5/flujo" || true
  sleep 2
done
