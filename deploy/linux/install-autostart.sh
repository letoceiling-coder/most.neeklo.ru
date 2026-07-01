#!/usr/bin/env bash
# Installs systemd user service for silent autostart (Linux).
set -euo pipefail

PROJECT_ROOT="${1:-$HOME/most.neeklo.ru}"
UNIT_DIR="${HOME}/.config/systemd/user"
mkdir -p "$UNIT_DIR"

cat >"${UNIT_DIR}/most-agent.service" <<EOF
[Unit]
Description=Most PC Agent (Chrome CDP + messenger bridge)
After=network-online.target graphical-session.target
Wants=network-online.target

[Service]
Type=simple
Environment=PROJECT_ROOT=${PROJECT_ROOT}
Environment=STEALTH=1
ExecStartPre=/bin/bash ${PROJECT_ROOT}/deploy/linux/start-chrome-debug.sh 9222
ExecStartPre=/bin/sleep 8
ExecStartPre=/bin/bash ${PROJECT_ROOT}/deploy/linux/open-messenger-tabs.sh 9222
ExecStart=/bin/bash ${PROJECT_ROOT}/deploy/linux/start-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable most-agent.service
systemctl --user start most-agent.service

echo "Installed most-agent.service (user systemd)."
echo "  Logs: ~/.most/logs/agent.log"
echo "  Status: systemctl --user status most-agent"
