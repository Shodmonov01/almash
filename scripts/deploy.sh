#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/almash"
cd "$ROOT"
git fetch --quiet origin main
git reset --hard origin/main
cd "$ROOT/frontend"
npm ci --no-audit --no-fund
VITE_API_URL= npm run build
mkdir -p "$ROOT/backend/public" "$ROOT/backend/uploads"
find "$ROOT/backend/public" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
cp -a "$ROOT/frontend/dist/." "$ROOT/backend/public/"
cd "$ROOT/backend"
npm ci --no-audit --no-fund
npm run build
npx prisma db push
cd "$ROOT"
/usr/local/bin/pm2 startOrReload ecosystem.config.cjs --env production --update-env
/usr/local/bin/pm2 save
curl --fail --silent --show-error http://127.0.0.1:4105/api/health
printf '\nDeployment completed.\n'
