#!/usr/bin/env bash
# Opens messenger tabs via CDP; skips already-open URLs.
set -euo pipefail

PORT="${1:-9222}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
STEALTH="${STEALTH:-0}"

URLS=(
  'https://web.telegram.org/a/'
  'https://web.max.ru/'
  'https://vk.com/im'
  'https://www.avito.ru/profile/messenger'
  'https://www.instagram.com/direct/inbox/'
  'https://web.whatsapp.com/'
)

if ! curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  STEALTH="$STEALTH" bash "$SCRIPT_DIR/start-chrome-debug.sh" "$PORT"
fi

OPEN_JSON="$(curl -sf "http://127.0.0.1:${PORT}/json/list" || echo '[]')"

for url in "${URLS[@]}"; do
  if echo "$OPEN_JSON" | grep -Fq "$url"; then
    continue
  fi
  enc="$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$url''', safe=''))" 2>/dev/null || echo "$url")"
  curl -sf -X PUT "http://127.0.0.1:${PORT}/json/new?${enc}" >/dev/null || true
  sleep 0.4
done
