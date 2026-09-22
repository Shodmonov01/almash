#!/bin/bash
# Runs on the VPS. Does not touch nginx / ports 80 and 443.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

ROOT="${SWAPTOY_ROOT:-$HOME/swaptoy}"
cd "$ROOT/backend"

mkdir -p uploads

if [ ! -f .env ]; then
  echo "Missing $ROOT/backend/.env — create it once on the server, then redeploy." >&2
  exit 1
fi

npm install
npx prisma generate
npx prisma db push

# Never seed here: seed.ts wipes data.

bash "$ROOT/backend/start.sh"
