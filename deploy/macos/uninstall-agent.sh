#!/usr/bin/env bash
# Stop Most autostart and agent (macOS).
set -euo pipefail

PLIST="${HOME}/Library/LaunchAgents/ru.neeklo.most.agent.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

pkill -f 'packages/agent/dist/index.js' 2>/dev/null || true
pkill -f 'Google Chrome.*remote-debugging-port=9222' 2>/dev/null || true

echo "LaunchAgent removed, agent stopped."
echo "Optional cleanup:"
echo "  rm -rf ~/.most"
echo "  rm -rf ~/most.neeklo.ru"
echo "Delete PC in dashboard: PC and accounts."
