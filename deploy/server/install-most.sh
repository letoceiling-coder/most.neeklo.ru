#!/usr/bin/env bash
# Safe install/update Most on genserver. Does not touch other nginx sites or databases.
set -eu

INSTALL_DIR="${INSTALL_DIR:-/opt/most}"
NGINX_AVAILABLE="/etc/nginx/sites-available/most.neeklo.ru.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/most.neeklo.ru.conf"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

cd "$INSTALL_DIR"

mkdir -p /var/www/certbot

if [[ ! -f .env ]]; then
  echo "Creating .env (first install only)..."
  OR_KEY=""
  for src in /var/www/kurs.neeklo.ru/.env /var/www/botme/.env; do
    if [[ -f "$src" ]]; then
      OR_KEY="$(grep -m1 '^OPENROUTER_API_KEY=' "$src" | cut -d= -f2- || true)"
      [[ -n "$OR_KEY" ]] && break
    fi
  done
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  cat > .env <<EOF
PUBLIC_URL=https://most.neeklo.ru
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgres://most:${POSTGRES_PASSWORD}@127.0.0.1:5437/most
OPERATOR_USER=admin
OPERATOR_PASSWORD=$(openssl rand -hex 12)
SESSION_SECRET=$(openssl rand -hex 32)
AGENT_SHARED_SECRET=$(openssl rand -hex 32)
OPENROUTER_API_KEY=${OR_KEY}
OPENROUTER_MODEL=openai/gpt-4o-mini
SERVER_PORT=3035
SERVER_HOST=127.0.0.1
DASHBOARD_DIST=${INSTALL_DIR}/packages/dashboard/dist
EOF
  chmod 600 .env
  echo "Saved credentials to ${INSTALL_DIR}/.env"
else
  echo "Keeping existing .env (not overwritten)."
  # Ensure required keys exist without replacing secrets.
  grep -q '^DATABASE_URL=' .env || echo "DATABASE_URL=postgres://most:$(grep POSTGRES_PASSWORD .env | cut -d= -f2-)@127.0.0.1:5437/most" >> .env
  grep -q '^DASHBOARD_DIST=' .env || echo "DASHBOARD_DIST=${INSTALL_DIR}/packages/dashboard/dist" >> .env
fi

echo "Starting PostgreSQL container only (127.0.0.1:5437)..."
$COMPOSE up -d db

echo "Installing dependencies and building..."
npm ci --no-audit --no-fund
npm run build:all

echo "Waiting for database..."
for i in $(seq 1 30); do
  if docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db pg_isready -U most -d most >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Applying schema..."
set -a
# shellcheck disable=SC1091
source .env
set +a
npm run migrate -w @most/server

echo "Starting API via pm2..."
pm2 startOrReload deploy/server/ecosystem.config.cjs --update-env
pm2 save

echo "Waiting for health..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3035/health >/dev/null 2>&1; then
    echo "Server healthy on :3035"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: server did not become healthy" >&2
    pm2 logs most-server --lines 40 --nostream
    exit 1
  fi
done

if [[ ! -f /etc/letsencrypt/live/most.neeklo.ru/fullchain.pem ]]; then
  echo "Installing temporary HTTP nginx config for certbot..."
  cp deploy/nginx/most.neeklo.ru.http-only.conf "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t
  systemctl reload nginx

  echo "Requesting TLS certificate for most.neeklo.ru..."
  certbot certonly --webroot -w /var/www/certbot \
    -d most.neeklo.ru \
    --non-interactive --agree-tos --keep-until-expiring \
    --cert-name most.neeklo.ru \
    --register-unsafely-without-email || certbot certonly --webroot -w /var/www/certbot \
    -d most.neeklo.ru --non-interactive --agree-tos --keep-until-expiring
fi

echo "Installing full HTTPS nginx config..."
cp deploy/nginx/most.neeklo.ru.conf "$NGINX_AVAILABLE"
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

echo "Done."
curl -sf https://most.neeklo.ru/health && echo
