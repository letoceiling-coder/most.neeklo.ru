#!/usr/bin/env bash
# Most agent with auto-restart. Logs to ~/.most/logs/agent.log
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NODE="${NODE_EXE:-node}"
LOG_DIR="${HOME}/.most/logs"
LOG_FILE="${LOG_DIR}/agent.log"
mkdir -p "$LOG_DIR"

cd "$PROJECT_ROOT"
ENTRY="$PROJECT_ROOT/packages/agent/dist/index.js"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"; }

if [[ ! -f "$ENTRY" ]]; then
  log "Building agent..."
  npm run build:shared >>"$LOG_FILE" 2>&1
  npm run build:agent >>"$LOG_FILE" 2>&1
fi

while true; do
  log "Starting Most agent"
  "$NODE" "$ENTRY" >>"$LOG_FILE" 2>&1 || true
  log "Agent exited, restarting in 5s..."
  sleep 5
done
