# Atlas Private Beta Deployment

This repository is deployed as a standalone internal-test app on a single Linux host.

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
- `ANALYSIS_PIPELINE_MODE=single`
- `ANALYSIS_LLM_PROVIDER=<provider>`
- `ANALYSIS_LLM_MODEL=<model>`
- optional stage overrides such as:
  - `ANALYSIS_FAST_LLM_PROVIDER`
  - `ANALYSIS_FAST_LLM_MODEL`
  - `ANALYSIS_REPORT_LLM_PROVIDER`
  - `ANALYSIS_REPORT_LLM_MODEL`

Only set the stage overrides when `ANALYSIS_PIPELINE_MODE=staged`.

## Nginx Example

```nginx
server {
    listen 80;
    server_name atlas.pin2pin.ai;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name atlas.pin2pin.ai;

    ssl_certificate /etc/ssl/atlas/fullchain.pem;
    ssl_certificate_key /etc/ssl/atlas/privkey.pem;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3111;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## systemd Example

```ini
[Unit]
Description=Atlas Next.js app
After=network.target

[Service]
Type=simple
User=atlas
Group=atlas
WorkingDirectory=/srv/atlas/app
Environment=NODE_ENV=production
EnvironmentFile=/srv/atlas/app/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## First Deploy

```bash
sudo mkdir -p /srv/atlas/app /var/lib/atlas/jobs /var/log/atlas/reports
sudo chown -R atlas:atlas /var/lib/atlas /var/log/atlas

cd /srv/atlas/app
npm ci
npm run build
npm run preflight:prod
sudo systemctl daemon-reload
sudo systemctl enable --now atlas
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
