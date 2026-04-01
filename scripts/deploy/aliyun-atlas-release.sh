#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-8.217.40.70}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY_PATH="${DEPLOY_KEY_PATH:-}"
ATLAS_DOMAIN="${ATLAS_DOMAIN:-atlas.pin2pin.ai}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/srv/atlas/app}"

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
require_command rsync

SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -p "${DEPLOY_PORT}"
  -i "${DEPLOY_KEY_PATH}"
)
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

printf -v RSYNC_RSH 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p %q -i %q' \
  "${DEPLOY_PORT}" "${DEPLOY_KEY_PATH}"

ssh "${SSH_OPTS[@]}" "${REMOTE}" "mkdir -p '${REMOTE_APP_DIR}'"

ssh "${SSH_OPTS[@]}" "${REMOTE}" "if [[ -f '${REMOTE_APP_DIR}/.env.production' ]]; then cp '${REMOTE_APP_DIR}/.env.production' /tmp/atlas.env.production.release-backup; fi"

rsync -az --delete --delete-excluded \
  --include '/app/***' \
  --include '/components/***' \
  --include '/config/***' \
  --include '/deploy/***' \
  --include '/docs/***' \
  --include '/lib/***' \
  --include '/prompts/***' \
  --include '/scripts/***' \
  --include '/tests/***' \
  --include '/.env.example' \
  --include '/README.md' \
  --include '/findings.md' \
  --include '/progress.md' \
  --include '/task_plan.md' \
  --include '/middleware.ts' \
  --include '/next-env.d.ts' \
  --include '/next.config.ts' \
  --include '/package.json' \
  --include '/package-lock.json' \
  --include '/tsconfig.json' \
  --include '/vitest.config.ts' \
  --include '/vitest.setup.ts' \
  --exclude '/**' \
  -e "${RSYNC_RSH}" \
  "${REPO_ROOT}/" "${REMOTE}:${REMOTE_APP_DIR}/"

ssh "${SSH_OPTS[@]}" "${REMOTE}" "bash -s" <<EOF
set -euo pipefail

cd "${REMOTE_APP_DIR}"

if [[ -f /tmp/atlas.env.production.release-backup ]]; then
  install -m 600 /tmp/atlas.env.production.release-backup .env.production
  rm -f /tmp/atlas.env.production.release-backup
fi

chown -R root:root "${REMOTE_APP_DIR}"
chown root:atlas .env.production
chmod 640 .env.production

if [[ ! -f .env.production ]]; then
  echo "missing ${REMOTE_APP_DIR}/.env.production" >&2
  exit 1
fi

npm ci
npm run build
set -a
. ./.env.production
set +a

mkdir -p "${ANALYSIS_JOB_STORE_DIR}" "$(dirname "${ATLAS_DB_PATH}")"
chown atlas:atlas "${ANALYSIS_JOB_STORE_DIR}" "$(dirname "${ATLAS_DB_PATH}")"
chmod 755 "${ANALYSIS_JOB_STORE_DIR}" "$(dirname "${ATLAS_DB_PATH}")"
if [[ -f "${ATLAS_DB_PATH}" ]]; then
  chown atlas:atlas "${ATLAS_DB_PATH}"
  chmod 660 "${ATLAS_DB_PATH}"
fi

npm run preflight:prod
systemctl enable atlas >/dev/null 2>&1 || true
systemctl restart atlas
systemctl is-active --quiet atlas
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3111/healthz >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:3111/healthz
EOF

cat <<EOF
Atlas release completed on ${DEPLOY_HOST}.

Verified:
- npm ci
- npm run build
- npm run preflight:prod
- systemctl restart atlas
- curl http://127.0.0.1:3111/healthz

If TLS is already active, confirm:
- https://${ATLAS_DOMAIN}/healthz
- https://${ATLAS_DOMAIN}/login
EOF
