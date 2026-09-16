#!/bin/bash
# Pull latest code into SWAPTOY_ROOT, install, migrate, build, restart.
# Designed to run on 95.182.119.105 as user rakhimovd.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

SRC="${SWAPTOY_SRC:-$HOME/swaptoy-src}"
ROOT="${SWAPTOY_ROOT:-$HOME/swaptoy-app}"
REPO="${SWAPTOY_REPO:-https://github.com/Shodmonov01/almash.git}"
BRANCH="${SWAPTOY_BRANCH:-cursor/production-server-4f8d}"
LOG="${SWAPTOY_WATCH_LOG:-$HOME/swaptoy/watch.log}"

mkdir -p "$(dirname "$LOG")" "$ROOT"
exec >>"$LOG" 2>&1

if [ ! -d "$SRC/.git" ]; then
  git clone --branch "$BRANCH" --single-branch "$REPO" "$SRC"
fi

cd "$SRC"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Next.js app (package.json with "next") — skip the old Fastify-only tree
if [ ! -f "$SRC/package.json" ] || ! grep -q '"next"' "$SRC/package.json"; then
  echo "$(date -Is) skip: not a Next.js SwapToy tree"
  exit 0
fi

echo "$(date -Is) deploy $(git rev-parse --short HEAD) branch=$BRANCH"

rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env \
  --exclude "*.db" \
  --exclude "*.db-journal" \
  --exclude public/uploads \
  "$SRC/" "$ROOT/"

mkdir -p "$ROOT/public/uploads" "$ROOT/prisma"

if [ ! -f "$ROOT/.env" ]; then
  echo "$(date -Is) missing $ROOT/.env" >&2
  exit 1
fi

cd "$ROOT"
npm ci

# If production DATABASE_URL is postgres, flip Prisma provider before generate.
if grep -q '^DATABASE_URL=.*postgresql' "$ROOT/.env"; then
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$ROOT/prisma/schema.prisma"
fi

npx prisma generate
npx prisma db push

# Seed only when there are no users yet
USER_COUNT="$(node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.count().then(c=>{console.log(c);return p.\$disconnect();}).catch(()=>{console.log(-1);process.exit(0);});
")"
if [ "$USER_COUNT" = "0" ]; then
  echo "$(date -Is) seeding empty database"
  npx tsx prisma/seed.ts
fi

npx next build
chmod +x "$ROOT/scripts/start-prod.sh"
SWAPTOY_ROOT="$ROOT" bash "$ROOT/scripts/start-prod.sh"
echo "$(date -Is) done"
