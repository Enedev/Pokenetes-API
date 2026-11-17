#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
mkdir -p "$ROOT/security-chaos"
touch "$ROOT/security-chaos/STOP"
export GAMEDAY_STOP=1
./rollback.sh
