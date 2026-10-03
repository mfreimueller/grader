#!/usr/bin/env bash
set -euo pipefail

# Build the Windows installer (NSIS) for Grader using the official
# electron-builder Docker image. No local Wine installation required.
#
# Usage:
#   ./scripts/build-windows.sh
#
# Environment:
#   IMAGE                Docker image to use (default: electronuserland/builder:22-wine)
#   NODE_MODULES_VOLUME  Docker volume for node_modules (default: grdr-node-modules)
#
# Code signing: set WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD to sign the
# installer. Without them the build is unsigned (Windows SmartScreen warning).
#
# The installer is written to dist/ (e.g. dist/Grader-1.3.1-win.exe).

IMAGE="${IMAGE:-electronuserland/builder:22-wine}"
NODE_MODULES_VOLUME="${NODE_MODULES_VOLUME:-grdr-node-modules}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$HOME/.cache/electron" "$HOME/.cache/electron-builder"

TTY_ARGS=""
if [ -t 0 ] && [ -t 1 ]; then
  TTY_ARGS="-ti"
fi

docker run --rm "$TTY_ARGS" \
  --env-file <(env | grep -iE '^(CSC_|WIN_|GH_|GITHUB_|ELECTRON_|NPM_|CI|DEBUG)=' || true) \
  -v "${PROJECT_DIR}:/project" \
  -v "${NODE_MODULES_VOLUME}:/project/node_modules" \
  -v "$HOME/.cache/electron:/root/.cache/electron" \
  -v "$HOME/.cache/electron-builder:/root/.cache/electron-builder" \
  -w /project \
  "${IMAGE}" \
  /bin/bash -c "npm ci && npm run build && npx electron-builder --win"
