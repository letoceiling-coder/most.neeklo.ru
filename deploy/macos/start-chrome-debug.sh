#!/usr/bin/env bash
# macOS: Chrome CDP + tabs (same as linux script, Chrome.app path handled in start-chrome-debug.sh)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
STEALTH="${STEALTH:-0}" bash "$SCRIPT_DIR/../linux/start-chrome-debug.sh" "${1:-9222}"
