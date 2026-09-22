#!/bin/bash
# Production start: Next.js on :8081 (or $PORT).
set -euo pipefail
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

ROOT="${SWAPTOY_ROOT:-$HOME/swaptoy-app}"
cd "$ROOT"
PID_FILE="${SWAPTOY_PID:-$HOME/swaptoy/app.pid}"
LOG="${SWAPTOY_LOG:-$HOME/swaptoy/app.log}"
PORT="${PORT:-8081}"
HOST="${HOST:-0.0.0.0}"

mkdir -p "$(dirname "$PID_FILE")" "$(dirname "$LOG")"

if [ -f "$PID_FILE" ]; then
  old="$(cat "$PID_FILE" || true)"
  if [ -n "${old:-}" ]; then
    kill "$old" 2>/dev/null || true
    # also stop children (next-server)
    pkill -P "$old" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# Free the port if a leftover next/tsx still holds it
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

set -a
# shellcheck disable=SC1091
[ -f "$ROOT/.env" ] && . "$ROOT/.env"
set +a

# Detach from the deploy flock (fd 9) so `next start` cannot hold
# ~/swaptoy/deploy.lock forever and block later cron deploys.
setsid npx next start -H "$HOST" -p "$PORT" >>"$LOG" 2>&1 9>&- </dev/null &
echo $! >"$PID_FILE"
echo "started pid=$(cat "$PID_FILE") port=$PORT"
