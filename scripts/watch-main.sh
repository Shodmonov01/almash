#!/bin/bash
# Server-side auto-deploy watcher. Cron: every 2 minutes.
set -euo pipefail
export SWAPTOY_BRANCH="${SWAPTOY_BRANCH:-cursor/production-server-4f8d}"
exec bash "$(dirname "$0")/server-deploy.sh"
