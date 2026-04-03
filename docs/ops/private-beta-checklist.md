# Atlas Private Beta Checklist

This is the shortest operational checklist for getting Atlas online and usable by internal testers.

Use this together with [docs/ops/atlas-private-beta-deployment.md](/Users/jilanfang/ai-hardware-assistant/docs/ops/atlas-private-beta-deployment.md).

## 1. Server Ready

- [ ] Linux server is reachable by SSH
- [ ] `Node.js 20`, `npm`, `Nginx`, `SQLite 3`, `systemd`, `git` are installed
- [ ] service user `atlas` exists
- [ ] writable directories exist:
  - `/var/lib/atlas`
  - `/var/lib/atlas/jobs`
  - `/var/log/atlas`
  - `/var/log/atlas/reports`

## 2. Code And Env Ready

- [ ] code is deployed to `/srv/atlas/app`
- [ ] `.env.production` is created from [`.env.example`](/Users/jilanfang/ai-hardware-assistant/.env.example)
- [ ] `scripts/deploy/aliyun-atlas-bootstrap.sh` has been run against `8.217.40.70`
- [ ] required env vars are filled:
  - `NODE_ENV`
  - `ANALYSIS_JOB_STORE_DIR`
  - `ATLAS_DB_PATH`
  - `SESSION_SECRET`
  - `SESSION_COOKIE_NAME`
  - `ATLAS_SELF_SERVICE_SIGNUP_ENABLED`
  - `ATLAS_ADMIN_USERNAMES`
  - `ATLAS_SIGNUP_RATE_LIMIT_WINDOW_MS`
  - `ATLAS_SIGNUP_RATE_LIMIT_MAX_ATTEMPTS`
  - `LYAPI_API_KEY`
  - `ANALYSIS_LLM_PROVIDER`
  - `ANALYSIS_LLM_MODEL`
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npm run preflight:prod`
- [ ] `scripts/deploy/aliyun-atlas-release.sh` finishes successfully
- [ ] if `/var/lib/atlas/atlas.db` already exists, its ownership is `atlas:atlas` and mode is compatible with writes

## 3. Reverse Proxy Ready

- [ ] DNS for `atlas.pin2pin.ai` points to the server
- [ ] Nginx is configured to proxy `atlas.pin2pin.ai` to `127.0.0.1:3111`
- [ ] the Atlas vhost is separate from the existing `pin2pin.ai` static-site root `/var/www/pin2pin/current`
- [ ] HTTPS certificate is installed
- [ ] `client_max_body_size` is large enough for datasheet uploads
- [ ] `nginx -t` passes
- [ ] Nginx reloaded successfully

## 4. App Process Ready

- [ ] `atlas.service` is installed in `systemd`
- [ ] `atlas.service` sets `NODE_ENV=production`
- [ ] `systemctl daemon-reload`
- [ ] `systemctl enable --now atlas`
- [ ] `systemctl status atlas` shows the process healthy
- [ ] `curl http://127.0.0.1:3111/healthz` returns `{"ok":true}`
- [ ] `curl https://atlas.pin2pin.ai/healthz` returns `{"ok":true}`

## 5. Account Provisioning Ready

- [ ] at least one admin account is created with [scripts/admin-users.mjs](/Users/jilanfang/ai-hardware-assistant/scripts/admin-users.mjs)
- [ ] admin username is included in `ATLAS_ADMIN_USERNAMES`
- [ ] first 20 invite codes are generated with [scripts/invite-codes.mjs](/Users/jilanfang/ai-hardware-assistant/scripts/invite-codes.mjs) or `/admin`
- [ ] at least one invite code is delivered to a tester through a secure channel
- [ ] fallback manual account path with `admin-users.mjs` is still verified if invite flow must be bypassed temporarily

## 6. Smoke Test Ready

Run one real smoke after deploy:

- [ ] open `/login`
- [ ] open `/register`
- [ ] invalid invite code is rejected
- [ ] one valid invite code completes a real registration
- [ ] the used invite code changes from `active` to `used`
- [ ] non-admin registered user cannot access `/admin`
- [ ] log in with a valid admin account
- [ ] `/admin` loads and displays both invite codes and users
- [ ] upload one real datasheet PDF
- [ ] see `processing` state
- [ ] wait for completed or partial result
- [ ] click at least one evidence-linked parameter
- [ ] ask one follow-up question
- [ ] export JSON
- [ ] export CSV and confirm the status column includes both reviewed and review-needed rows when applicable
- [ ] log out and confirm the app asks for login again

## 7. Audit And Reporting Ready

- [ ] `login_success` appears in SQLite
- [ ] `analysis_created` appears after upload
- [ ] `followup_asked` appears after follow-up
- [ ] `export_json` / `export_csv` appear after export
- [ ] one daily report command is tested:

```bash
ATLAS_DB_PATH=/var/lib/atlas/atlas.db node /srv/atlas/app/scripts/audit-summary.mjs --date 2026-03-30 --format json
```

- [ ] optional cron for daily report output is installed

## 8. Backup Ready

- [ ] daily backup exists for `/var/lib/atlas/atlas.db`
- [ ] daily backup exists for `/var/lib/atlas/jobs`
- [ ] restore path is documented
- [ ] one restore drill has been tried on a non-production path

## 9. Launch Decision

Only mark private beta ready when all of these are true:

- [ ] login works
- [ ] invite-only registration works
- [ ] `/admin` access control works
- [ ] one real datasheet flow works end to end
- [ ] audit data is queryable
- [ ] backup exists
- [ ] rollback path is clear
