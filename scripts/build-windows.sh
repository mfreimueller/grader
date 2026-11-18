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

# Gradeflow: the Agent SDK runs the Claude Code binary of its per-platform package, but npm in this Linux
# container only installs the linux-x64 one. Install the Windows package (version = the pinned SDK version) into
# a separate prefix (--force skips npm's platform check) and copy it into node_modules, leaving the rest of the
# tree untouched. Runs after `npm run build`, which needs the Linux binaries of the build tools.
SDK_VERSION="$(node -p "require('${PROJECT_DIR}/package.json').dependencies['@anthropic-ai/claude-agent-sdk']")"
INSTALL_WIN_SDK_BINARY="rm -rf /tmp/sdk-win \
  && npm install --no-save --force --no-audit --no-fund --prefix /tmp/sdk-win @anthropic-ai/claude-agent-sdk-win32-x64@${SDK_VERSION} \
  && rm -rf node_modules/@anthropic-ai/claude-agent-sdk-win32-x64 \
  && cp -R /tmp/sdk-win/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64 node_modules/@anthropic-ai/"

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
  /bin/bash -c "npm ci && npm run build && ${INSTALL_WIN_SDK_BINARY} && npx electron-builder --win"
