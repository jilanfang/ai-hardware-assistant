#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-8.217.40.70}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY_PATH="${DEPLOY_KEY_PATH:-}"
ATLAS_DOMAIN="${ATLAS_DOMAIN:-atlas.pin2pin.ai}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/srv/atlas/app}"
REMOTE_SERVICE_PATH="${REMOTE_SERVICE_PATH:-/etc/systemd/system/atlas.service}"
REMOTE_NGINX_AVAILABLE="${REMOTE_NGINX_AVAILABLE:-/etc/nginx/sites-available/${ATLAS_DOMAIN}.conf}"
REMOTE_NGINX_ENABLED="${REMOTE_NGINX_ENABLED:-/etc/nginx/sites-enabled/${ATLAS_DOMAIN}.conf}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

if [[ -z "${DEPLOY_KEY_PATH}" ]]; then
  echo "set DEPLOY_KEY_PATH=/absolute/path/to/pin2pin.pem before running this script" >&2
  exit 1
fi

require_command ssh
require_command scp

SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -p "${DEPLOY_PORT}"
  -i "${DEPLOY_KEY_PATH}"
)
SCP_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -P "${DEPLOY_PORT}"
  -i "${DEPLOY_KEY_PATH}"
)
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

sed "s|__ATLAS_DOMAIN__|${ATLAS_DOMAIN}|g" \
  "${REPO_ROOT}/deploy/nginx/atlas.pin2pin.ai.conf" \
  > "${TMP_DIR}/${ATLAS_DOMAIN}.conf"

scp "${SCP_OPTS[@]}" \
  "${REPO_ROOT}/deploy/systemd/atlas.service" \
  "${TMP_DIR}/${ATLAS_DOMAIN}.conf" \
  "${REMOTE}:/tmp/"

ssh "${SSH_OPTS[@]}" "${REMOTE}" "bash -s" <<EOF
set -euo pipefail

if ! id -u atlas >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin atlas
fi

mkdir -p "${REMOTE_APP_DIR}" /var/lib/atlas/jobs /var/log/atlas/reports /etc/nginx/sites-available /etc/nginx/sites-enabled
chown -R atlas:atlas /var/lib/atlas /var/log/atlas

install -m 644 /tmp/atlas.service "${REMOTE_SERVICE_PATH}"
install -m 644 "/tmp/${ATLAS_DOMAIN}.conf" "${REMOTE_NGINX_AVAILABLE}"
ln -sfn "${REMOTE_NGINX_AVAILABLE}" "${REMOTE_NGINX_ENABLED}"

systemctl daemon-reload
nginx -t
systemctl reload nginx

rm -f /tmp/atlas.service "/tmp/${ATLAS_DOMAIN}.conf"
EOF

cat <<EOF
Atlas bootstrap complete on ${DEPLOY_HOST}.

What is ready now:
- service user: atlas
- app directory: ${REMOTE_APP_DIR}
- writable dirs: /var/lib/atlas, /var/log/atlas
- systemd unit: ${REMOTE_SERVICE_PATH}
- nginx vhost: ${REMOTE_NGINX_AVAILABLE}

Next steps:
1. Sync code with scripts/deploy/aliyun-atlas-release.sh
2. Create ${REMOTE_APP_DIR}/.env.production from .env.example
3. Issue TLS after atlas.pin2pin.ai resolves to this server:
   certbot --nginx -d ${ATLAS_DOMAIN}
4. Start the service:
   systemctl enable --now atlas
EOF
