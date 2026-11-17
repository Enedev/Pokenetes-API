#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ -f "$ROOT/security-chaos/gameday.env" ]; then set -a; source "$ROOT/security-chaos/gameday.env"; set +a; fi
# shellcheck disable=SC1091
source "$ROOT/security-chaos/lib/gameday.sh"
export GD_EXP=exp1 GD_ROUND="${GD_ROUND:-0}" GD_RUN="${GD_RUN:-1}" GD_ACTOR="${GD_ACTOR:-neithan}"
export GD_TRACE="${GD_TRACE:-rollback-$(date -u +%H%M%S)}"
export GD_EVIDENCE="${GD_EVIDENCE:-$ROOT/security-chaos/evidence/exp1/ronda-${GD_ROUND}}"
mkdir -p "$GD_EVIDENCE"
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN || true
gd_log rollback_start credenciales "el subshell ya no las exporta; expiran solas en 6 h o menos"
code=$(gd_canary_flow)
gd_log rollback_done flujo "$code"
if [ "$code" = "200" ]; then
  gd_log steady_state_restored flujo 200
else
  gd_log aborted flujo "$code"
  exit 1
fi
