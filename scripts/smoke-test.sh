#!/usr/bin/env bash
# API smoke test against a running FPMS API (development data). Usage: bash scripts/smoke-test.sh https://localhost:44311
set -euo pipefail
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
NODE_TLS_REJECT_UNAUTHORIZED=0 node smoke-test.mjs "${1:-https://localhost:44311}"
