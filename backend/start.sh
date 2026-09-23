#!/bin/bash
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$HOME/swaptoy/backend"
if [ -f "$HOME/swaptoy/app.pid" ]; then
  kill "$(cat "$HOME/swaptoy/app.pid")" 2>/dev/null || true
  rm -f "$HOME/swaptoy/app.pid"
fi
export NODE_ENV="${NODE_ENV:-production}"
nohup npx tsx src/server.ts >> "$HOME/swaptoy/app.log" 2>&1 &
echo $! > "$HOME/swaptoy/app.pid"
echo started pid=$(cat "$HOME/swaptoy/app.pid")
