#!/usr/bin/env bash
# macOS LaunchAgent for silent autostart at login.
set -euo pipefail

PROJECT_ROOT="${1:-$HOME/most.neeklo.ru}"
PLIST="${HOME}/Library/LaunchAgents/ru.neeklo.most.agent.plist"
LOG_DIR="${HOME}/.most/logs"
mkdir -p "$LOG_DIR"

cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ru.neeklo.most.agent</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/launch.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/launch.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PROJECT_ROOT</key><string>${PROJECT_ROOT}</string>
    <key>STEALTH</key><string>1</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>sleep 45; STEALTH=1 bash "${PROJECT_ROOT}/deploy/macos/start-chrome-debug.sh" 9222; sleep 8; bash "${PROJECT_ROOT}/deploy/macos/open-messenger-tabs.sh" 9222; bash "${PROJECT_ROOT}/deploy/macos/start-agent.sh"</string>
  </array>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "LaunchAgent installed: $PLIST"
echo "  Logs: $LOG_DIR/"
