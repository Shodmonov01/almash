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
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4105/api/health 2>/dev/null; then
    printf '\nDeployment completed.\n'
    exit 0
  fi
  sleep 1
done
echo "Application health check failed after 30 seconds." >&2
exit 1
