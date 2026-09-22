#!/bin/bash
# Server-side auto-deploy: pull origin/main, rebuild frontend and backend separately, restart :8081.
# Does not use GitHub Secrets. Does not touch nginx / :80 / :443.
set -euo pipefail

SRC="${SWAPTOY_SRC:-$HOME/swaptoy-src}"
APP="${SWAPTOY_ROOT:-$HOME/swaptoy}"
REPO="${SWAPTOY_REPO:-https://github.com/Shodmonov01/almash.git}"
LOG="${SWAPTOY_WATCH_LOG:-$HOME/swaptoy/watch.log}"

mkdir -p "$(dirname "$LOG")" "$APP"
exec >>"$LOG" 2>&1

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if [ ! -d "$SRC/.git" ]; then
  git clone --branch main --single-branch "$REPO" "$SRC"
fi

cd "$SRC"
git fetch origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date -Is) deploy $LOCAL -> $REMOTE"
git reset --hard origin/main

if [ ! -f "$SRC/backend/src/server.ts" ] || [ ! -f "$SRC/frontend/package.json" ]; then
  echo "$(date -Is) skip: main still is not frontend+backend"
  exit 0
fi

mkdir -p "$APP/backend/uploads" "$APP/scripts"
rsync -a --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude "*.db" \
  --exclude uploads \
  --exclude public \
  "$SRC/backend/" "$APP/backend/"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  "$SRC/frontend/" "$APP/frontend/"
if [ -f "$SRC/scripts/server-deploy.sh" ]; then
  cp "$SRC/scripts/server-deploy.sh" "$APP/scripts/server-deploy.sh"
fi

cd "$APP/frontend"
npm install
npm run build

rm -rf "$APP/backend/public"
mkdir -p "$APP/backend/public"
cp -a "$APP/frontend/dist/." "$APP/backend/public/"

cd "$APP/backend"
if [ ! -f .env ]; then
  echo "missing $APP/backend/.env" >&2
  exit 1
fi
npm install
npx prisma generate
npx prisma db push
chmod +x "$APP/backend/start.sh"
bash "$APP/backend/start.sh"
echo "$(date -Is) done"
