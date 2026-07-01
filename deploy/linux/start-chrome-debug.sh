#!/usr/bin/env bash
# Chrome with CDP for Most. Exits silently if CDP already running.
set -euo pipefail

PORT="${1:-9222}"
STEALTH="${STEALTH:-0}"
PROFILE_DIR="${MOST_CHROME_PROFILE:-$HOME/.most/chrome-profile}"

if curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  exit 0
fi

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done
if [[ -z "$CHROME" && -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi
if [[ -z "$CHROME" ]]; then
  echo "Chrome/Chromium not found" >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"
ARGS=(
  "--remote-debugging-port=${PORT}"
  "--user-data-dir=${PROFILE_DIR}"
  "--no-first-run"
  "--no-default-browser-check"
  "--restore-last-session"
  "--disable-infobars"
  "--noerrdialogs"
)
if [[ "$STEALTH" == "1" ]]; then
  ARGS+=("--start-minimized" "--window-position=-2400,-2400")
fi

nohup "$CHROME" "${ARGS[@]}" >/dev/null 2>&1 &
disown

for i in $(seq 1 25); do
  sleep 1
  curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1 && exit 0
done
echo "Chrome CDP did not start on port ${PORT}" >&2
exit 1
