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
- [ ] required env vars are filled:
  - `ANALYSIS_JOB_STORE_DIR`
  - `ATLAS_DB_PATH`
  - `SESSION_SECRET`
  - `SESSION_COOKIE_NAME`
  - `LYAPI_API_KEY`
  - `ANALYSIS_LLM_PROVIDER`
  - `ANALYSIS_LLM_MODEL`
- [ ] `npm ci`
- [ ] `npm run build`

## 3. Reverse Proxy Ready

- [ ] DNS for `atlas.pin2pin.ai` points to the server
- [ ] Nginx is configured to proxy `atlas.pin2pin.ai` to `127.0.0.1:3111`
- [ ] HTTPS certificate is installed
- [ ] `client_max_body_size` is large enough for datasheet uploads
- [ ] `nginx -t` passes
- [ ] Nginx reloaded successfully

## 4. App Process Ready

- [ ] `atlas.service` is installed in `systemd`
- [ ] `systemctl daemon-reload`
- [ ] `systemctl enable --now atlas`
- [ ] `systemctl status atlas` shows the process healthy
- [ ] `curl https://atlas.pin2pin.ai/healthz` returns `{"ok":true}`

## 5. Account Provisioning Ready

- [ ] first internal accounts are created with [scripts/admin-users.mjs](/Users/jilanfang/ai-hardware-assistant/scripts/admin-users.mjs)
- [ ] usernames and initial passwords are exported to CSV
- [ ] account list is delivered to testers through a secure channel
- [ ] at least one disabled-account test has been tried

## 6. Smoke Test Ready

Run one real smoke after deploy:

- [ ] open `/login`
- [ ] log in with a valid internal account
- [ ] upload one real datasheet PDF
- [ ] see `processing` state
- [ ] wait for completed or partial result
- [ ] click at least one evidence-linked parameter
- [ ] ask one follow-up question
- [ ] export JSON
- [ ] export CSV after confirming at least one parameter
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
- [ ] one real datasheet flow works end to end
- [ ] audit data is queryable
- [ ] backup exists
- [ ] rollback path is clear
