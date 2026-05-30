#!/usr/bin/env bash
set -euo pipefail

REMOTE="mf9501@sabic.uberspace.de"
REMOTE_PATH="/home/mf9501/html/grader/updates"

rsync -avP \
  --include='latest-*.yml' \
  --include='Grader-*.AppImage' \
  --include='grader_*.deb' \
  --exclude='*' \
  dist/ "$REMOTE:$REMOTE_PATH/"
