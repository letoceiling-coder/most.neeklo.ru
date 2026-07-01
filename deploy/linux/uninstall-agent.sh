#!/usr/bin/env bash
# Stop Most autostart and agent (Linux).
set -euo pipefail

systemctl --user disable most-agent.service 2>/dev/null || true
systemctl --user stop most-agent.service 2>/dev/null || true
rm -f "${HOME}/.config/systemd/user/most-agent.service"
systemctl --user daemon-reload 2>/dev/null || true

pkill -f 'packages/agent/dist/index.js' 2>/dev/null || true
pkill -f 'remote-debugging-port=9222' 2>/dev/null || true

echo "Autostart disabled, agent stopped."
echo "Optional cleanup:"
echo "  rm -rf ~/.most"
echo "  rm -rf ~/most.neeklo.ru   # project folder"
echo "Delete PC in dashboard: PC and accounts."
