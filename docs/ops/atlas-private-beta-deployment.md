# Atlas Private Beta Deployment

This repository is deployed as a standalone internal-test app on a single Linux host.

Current target host for Atlas:

- server IP: `8.217.40.70`
- existing public site: `pin2pin.ai` / `www.pin2pin.ai`
- existing site layout: static files under `/var/www/pin2pin/current`, served directly by Nginx

Atlas should stay isolated from that static-site path. Do not reuse `/var/www/pin2pin/current`.

## Recommended Entry

- Subdomain: `atlas.pin2pin.ai`
- App port: `127.0.0.1:3111`
- Runtime: `next build` + `next start`
- Startup preflight: `npm run preflight:prod`
- Process manager: `systemd`
- Reverse proxy: `Nginx`

Reasoning:

- clean separation from the marketing site on the root domain
- simpler cookie scope and TLS handling
- easier rollback and operational isolation

## Included Repo Assets

This repository now includes the deployment assets for the Aliyun host:

- Nginx bootstrap vhost: [`deploy/nginx/atlas.pin2pin.ai.conf`](/Users/jilanfang/ai-hardware-assistant/deploy/nginx/atlas.pin2pin.ai.conf)
- systemd unit: [`deploy/systemd/atlas.service`](/Users/jilanfang/ai-hardware-assistant/deploy/systemd/atlas.service)
- one-time host bootstrap script: [`scripts/deploy/aliyun-atlas-bootstrap.sh`](/Users/jilanfang/ai-hardware-assistant/scripts/deploy/aliyun-atlas-bootstrap.sh)
- release script: [`scripts/deploy/aliyun-atlas-release.sh`](/Users/jilanfang/ai-hardware-assistant/scripts/deploy/aliyun-atlas-release.sh)

## Server Dependencies

- Node.js 20 LTS
- npm
- Nginx
- SQLite 3
- systemd
- git
- bash
- optional: `python3`
- optional: `logrotate`

No Redis, MySQL, or queue service is required for the current single-machine scope.

## Directory Layout

- App code: `/srv/atlas/app`
- SQLite DB: `/var/lib/atlas/atlas.db`
- Job store: `/var/lib/atlas/jobs`
- Logs and reports: `/var/log/atlas`

Recommended ownership:

- service user: `atlas`
- writable paths: `/var/lib/atlas`, `/var/log/atlas`
- code directory should be read-only for the service user
- if `/var/lib/atlas/atlas.db` was ever created by `root`, reset it before login testing:
  - `chown atlas:atlas /var/lib/atlas/atlas.db`
  - `chmod 660 /var/lib/atlas/atlas.db`

## Required Environment

Copy [`.env.example`](/Users/jilanfang/ai-hardware-assistant/.env.example) to the server and set:

- `NODE_ENV=production`
- `ANALYSIS_JOB_STORE_DIR=/var/lib/atlas/jobs`
- `ATLAS_DB_PATH=/var/lib/atlas/atlas.db`
- `SESSION_SECRET=<strong-random-secret>`
- `SESSION_COOKIE_NAME=atlas_session`
- `LYAPI_API_KEY=<your-lyapi-key>`
- optional `LYAPI_BASE_URL=https://lyapi.com`
- optional `VECTORENGINE_API_KEY=<your-vectorengine-key>`
- optional `VECTORENGINE_BASE_URL=https://api.vectorengine.ai`
- `ANALYSIS_ENABLE_ODL=false`
- `ANALYSIS_PIPELINE_MODE=staged`
- `ANALYSIS_LLM_PROVIDER=<provider>`
- `ANALYSIS_LLM_MODEL=<model>`
- `ANALYSIS_IDENTITY_LLM_PROVIDER=lyapi`
- `ANALYSIS_IDENTITY_LLM_MODEL=gemini-3-flash-preview`
- `ANALYSIS_FAST_LLM_PROVIDER=lyapi`
- `ANALYSIS_FAST_LLM_MODEL=gpt-4o`
- `ANALYSIS_REPORT_LLM_PROVIDER=lyapi`
- `ANALYSIS_REPORT_LLM_MODEL=gemini-3.1-pro-preview`
- `ANALYSIS_ARBITRATION_LLM_PROVIDER=lyapi`
- `ANALYSIS_ARBITRATION_LLM_MODEL=deepseek-v3.2`
- `ANALYSIS_FOLLOW_UP_LLM_PROVIDER=lyapi`
- `ANALYSIS_FOLLOW_UP_LLM_MODEL=gemini-3-flash-preview`

This is the currently deployed production shape. If you intentionally switch back to `single`, remove the stage overrides you no longer use.

## Bootstrap On 8.217.40.70

Use the same SSH identity that already manages the public site:

```bash
chmod 600 /Users/jilanfang/Downloads/pin2pin.pem
DEPLOY_KEY_PATH=/Users/jilanfang/Downloads/pin2pin.pem \
scripts/deploy/aliyun-atlas-bootstrap.sh
```

What this does:

- creates the `atlas` service user if missing
- creates `/srv/atlas/app`, `/var/lib/atlas/jobs`, and `/var/log/atlas/reports`
- installs `atlas.service` into `systemd`
- installs an HTTP-only Nginx vhost for `atlas.pin2pin.ai`
- reloads Nginx

This does not touch the existing `pin2pin.ai` static-site root at `/var/www/pin2pin/current`.

## First Deploy

1. Create the production env file on the server:

```bash
ssh -i /Users/jilanfang/Downloads/pin2pin.pem root@8.217.40.70
cd /srv/atlas/app
cp .env.example .env.production
```

2. Fill `.env.production` with the real secrets and model config.

3. Sync code, install deps, build, preflight, and restart Atlas:

```bash
DEPLOY_KEY_PATH=/Users/jilanfang/Downloads/pin2pin.pem \
scripts/deploy/aliyun-atlas-release.sh
```

The release script now also re-applies ownership for `ANALYSIS_JOB_STORE_DIR`, the SQLite parent directory, and `ATLAS_DB_PATH` when the DB file already exists, which prevents `SQLITE_READONLY` regressions after manual root-side maintenance.

4. After DNS for `atlas.pin2pin.ai` points to `8.217.40.70`, issue TLS on the server:

```bash
ssh -i /Users/jilanfang/Downloads/pin2pin.pem root@8.217.40.70
certbot --nginx -d atlas.pin2pin.ai
```

5. Verify:

```bash
curl http://127.0.0.1:3111/healthz
curl https://atlas.pin2pin.ai/healthz
curl -I https://atlas.pin2pin.ai/login
```

The preflight command is intentionally strict in production. It fails fast when:

- `SESSION_SECRET` is missing
- `ATLAS_DB_PATH` is missing
- `ANALYSIS_JOB_STORE_DIR` is missing
- the primary `ANALYSIS_LLM_PROVIDER` / `ANALYSIS_LLM_MODEL` pair is missing
- the configured provider key is missing
- the configured SQLite/job-store paths are not writable

## Account Provisioning

Create one account:

```bash
ATLAS_DB_PATH=/var/lib/atlas/atlas.db node scripts/admin-users.mjs create --username alice --display-name "Alice" --password "TempPass123!"
```

Import usernames from a text file and print generated passwords as CSV:

```bash
ATLAS_DB_PATH=/var/lib/atlas/atlas.db node scripts/admin-users.mjs import --input /srv/atlas/app/internal-users.txt
```

## Audit Summary

Query one day as JSON:

```bash
ATLAS_DB_PATH=/var/lib/atlas/atlas.db node scripts/audit-summary.mjs --date 2026-03-30 --format json
```

Query one day as CSV:

```bash
ATLAS_DB_PATH=/var/lib/atlas/atlas.db node scripts/audit-summary.mjs --date 2026-03-30 --format csv
```

Optional daily cron:

```cron
5 0 * * * ATLAS_DB_PATH=/var/lib/atlas/atlas.db /usr/bin/node /srv/atlas/app/scripts/audit-summary.mjs --date $(date -d "yesterday" +\%F) --format json > /var/log/atlas/reports/$(date -d "yesterday" +\%F).json
```

## Backups

- Backup `/var/lib/atlas/atlas.db` daily
- Backup `/var/lib/atlas/jobs` daily or prune by retention policy
- Test restore of both together, because job snapshots and audit/auth DB are separate stores
