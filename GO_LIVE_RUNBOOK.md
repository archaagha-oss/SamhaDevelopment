# Go-Live Runbook — Samha CRM

**Audience:** Operator on launch day. Read top-to-bottom; don't skip steps.
**Pre-req:** All P0 items in `LAUNCH_READINESS_AUDIT.md` Section F Phase 0 are
closed. If any P0 is open, **stop and address it first.**

---

## 0. Pre-flight (T-7 days)

| # | Check | Owner | Status |
| - | --- | --- | :-: |
| 0.1 | Production database provisioned (cPanel MariaDB / managed MySQL ≥ 8.0) | DevOps | ☐ |
| 0.2 | DB user has CREATE / ALTER / INDEX privileges on the prod schema | DevOps | ☐ |
| 0.3 | S3 bucket created in target region; IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` only | DevOps | ☐ |
| 0.4 | Clerk production app created; live keys captured in vault | DevOps | ☐ |
| 0.5 | Twilio prod account: Auth Token, Account SID, WhatsApp sender, SMS sender provisioned | Comms | ☐ |
| 0.6 | SendGrid (or Resend) prod API key + inbound parse domain configured | Comms | ☐ |
| 0.7 | DNS: `app.<domain>` → web; `api.<domain>` → api; `https://` cert via cPanel AutoSSL | DevOps | ☐ |
| 0.8 | Sentry projects (api + web) created; DSNs in vault | DevOps | ☐ |
| 0.9 | Backup target configured (mysqldump → S3 nightly, 30-day retention) | DevOps | ☐ |
| 0.10 | Restore drill executed against a sandbox DB within the last 7 days; runtime measured | DevOps | ☐ |
| 0.11 | UAT sign-off: end-to-end QA from `MANUAL_QA_CHECKLIST.md` passes on staging | QA | ☐ |
| 0.12 | Audit blockers from `LAUNCH_READINESS_AUDIT.md` Phase 0 all closed | Lead Eng | ☐ |

If **any** row is unchecked at T-1 day, escalate before proceeding.

---

## 1. Production environment configuration

Confirmed required env vars (every one of these must be set on the prod host):

```
# Core
DATABASE_URL=mysql://<user>:<pass>@<host>:3306/<db>
NODE_ENV=production
PORT=3000

# Auth
CLERK_PUBLISHABLE_KEY=pk_live_*
CLERK_SECRET_KEY=sk_live_*

# Storage
AWS_S3_BUCKET=samha-prod
AWS_S3_REGION=eu-central-1
AWS_ACCESS_KEY_ID=*
AWS_SECRET_ACCESS_KEY=*
MAX_UPLOAD_SIZE=52428800

# Comms
TWILIO_ACCOUNT_SID=*
TWILIO_AUTH_TOKEN=*
TWILIO_WHATSAPP_FROM=whatsapp:+9715xxxxxxx
TWILIO_SMS_FROM=+9715xxxxxxx
SENDGRID_API_KEY=*
SENDGRID_INBOUND_TOKEN=*           # signs inbound parse webhook
INBOUND_EMAIL_DOMAIN=parse.<domain>

# Web (build-time)
VITE_API_URL=https://api.<domain>
VITE_CLERK_PUBLISHABLE_KEY=pk_live_*
VITE_SENTRY_DSN=*

# API observability
SENTRY_DSN=*
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://app.<domain>

# Optional production tuning
DB_POOL_MAX=20
DB_POOL_TIMEOUT_MS=30000
REQUEST_TIMEOUT_MS=30000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

Verify with:

```
node -e "['DATABASE_URL','CLERK_SECRET_KEY','AWS_S3_BUCKET','TWILIO_AUTH_TOKEN','SENDGRID_API_KEY','SENTRY_DSN'].forEach(k => process.env[k] || (console.error('MISSING',k), process.exit(1))); console.log('OK')"
```

---

## 2. Launch day timeline

### T-2 hours — freeze & backup

1. Lock master branch; no merges during deploy.
2. Take a fresh DB snapshot:
   ```
   mysqldump --single-transaction --routines --triggers \
     -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$DB_NAME" \
     | gzip > "/backups/pre-launch-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
   ```
3. Upload that snapshot to S3 with versioning enabled.
4. Note the file path. **This is the rollback target.**

### T-60 min — staging smoke test

1. Run `MANUAL_QA_CHECKLIST.md` Section "Smoke Tests" (10 min) on staging
   pointing at production-like data.
2. If anything fails, **abort launch** and reschedule.

### T-30 min — prod migrations & deploy

1. **Migrations.** Run `npx prisma migrate deploy` on prod. If using
   `prisma db push` instead, do `--accept-data-loss=false`. Migrations are
   in `apps/api/prisma/migrations/manual/*.sql` — apply each in order if
   pushing manually:
   ```
   for f in apps/api/prisma/migrations/manual/*.sql; do
     echo "Applying $f"
     mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$DB_NAME" < "$f"
   done
   ```
2. **Build artifacts** on CI (master tag):
   ```
   git tag -a v1.0.0 -m "Initial production launch"
   git push origin v1.0.0
   ```
   CI builds `apps/api` and `apps/web` and uploads `dist/` artifacts (or
   rsyncs to cPanel directly per `.github/workflows/ci.yml` `deploy` job).
3. **API rolling reload:**
   ```
   pm2 reload ecosystem.config.js --env production
   ```
4. **Web deploy:** rsync `apps/web/dist/` to the web document root.
5. Set `.htaccess` cache headers for hashed assets (1 year) and `index.html`
   (no-cache):
   ```
   <FilesMatch "\.(js|css|woff2?|svg|png|jpg)$">
     Header set Cache-Control "max-age=31536000, immutable"
   </FilesMatch>
   <FilesMatch "^index\.html$">
     Header set Cache-Control "no-cache, no-store, must-revalidate"
   </FilesMatch>
   ```

### T-0 — go live

1. Flip DNS / load balancer to point at the new instance.
2. Verify:
   - `curl -I https://api.<domain>/health` → `200 OK`
   - `curl -I https://app.<domain>` → `200 OK`, `X-Frame-Options: DENY`,
     `Strict-Transport-Security: max-age=...`
   - One real user logs in via Clerk; bell fetches; lead list loads.

### T+30 min — observe

1. Watch Sentry for new errors. Threshold: > 10 errors in 10 min → investigate.
2. Watch `/metrics`:
   - p99 latency < 1500 ms
   - 5xx rate < 0.5%
   - DB connection pool utilization < 70%
3. Watch SSE: `curl https://api.<domain>/api/stream` — should hold open with
   periodic `event: heartbeat`.

### T+2h — sign-off

1. Run `MANUAL_QA_CHECKLIST.md` Section "Smoke Tests" against production.
2. If clean, post in launch channel: `Samha CRM v1.0.0 LIVE (launch-tag)`.
3. Schedule T+24h log review.

---

## 3. Rollback plan

Trigger rollback if **any** of these happen in the first 4 hours:

- 5xx rate > 5% sustained 5 min
- `/health` returns non-200 for ≥ 60 sec
- Authentication broken for > 1% of users
- Data corruption observed in audit logs
- DB connection pool exhausted

### Rollback procedure (≤ 15 minutes)

1. **Halt traffic.** DNS / LB → maintenance page (or 503 from API).
2. **API rollback** (zero data change yet):
   ```
   pm2 stop ecosystem.config.js
   git checkout v0.X.Y-previous     # last known-good tag
   npm ci --workspaces
   npm run build --workspace=apps/api
   pm2 start ecosystem.config.js --env production
   ```
3. **DB rollback** (only if migrations ran and corrupted data):
   ```
   mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$DB_NAME" \
     < /backups/pre-launch-<TIMESTAMP>.sql.gz   # decompress first
   ```
   Note: this **discards all data created post-launch.** That's the cost of
   rollback. Communicate before pulling this trigger.
4. **Web rollback:** rsync the previous `dist/` artifact back to the web root.
5. **Verify:** `curl /health` → 200, one user login works.
6. **Lift traffic block.** DNS/LB back to normal.
7. **Post-mortem within 48h.** What broke, why, and what would have caught it.

### Partial rollback (preferred when possible)

If only one feature is broken and the rest works:

1. **Feature flag off** the broken module via Settings UI or `AppSettings`
   row update. (Many Phase-D modules are already flag-gated.)
2. **PR + hotfix** the issue.
3. **Deploy hotfix** without rolling the whole app back.

---

## 4. Day-1 watch list (T+24h)

Operator runs through this list 24 hours after launch.

| Check | Pass criterion |
| --- | --- |
| Sentry error rate | < 0.5% of requests |
| 5xx rate (`/metrics`) | < 0.5% |
| p99 latency | < 1500 ms |
| Disk usage | < 70% |
| Memory utilization (per PM2) | < 75% |
| DB connection pool peak | < 80% of `DB_POOL_MAX` |
| SSE concurrent connections | < 500 (cap: per `SECTION E.2` recommendation) |
| Backup ran overnight | Latest snapshot in S3 |
| Inbound Twilio webhook | At least one real WhatsApp message logged |
| Inbound email parse | At least one real Bayut/PF/Dubizzle email parsed (if applicable) |
| User logins (Clerk) | > 0 unique production users |
| New leads created | > 0 |
| New activities logged | > 0 |
| Payments recorded | If finance team is using it |
| Audit log entries | Match user-visible actions |

---

## 5. Communication plan

### Stakeholders to notify

- **Pre-launch (T-7d, T-1d):** Sales lead, Finance lead, IT lead, Director
- **Launch (T+0):** All users via in-app banner ("Welcome to Samha CRM v1.0")
- **Issue / rollback:** Sales lead, Finance lead immediately; users via banner
- **Post-launch (T+24h):** Status update to leadership

### Message templates

**Pre-launch (T-1d):**
> Samha CRM v1.0 goes live tomorrow at 09:00 GST. Plan for a 2-hour quiet
> window from 08:00–10:00 (no critical sales activity). Old workflow stays as
> backup until end of week.

**Launch (T+0):**
> Samha CRM v1.0 is live. Sign in at https://app.<domain>. If you see any
> issue, please report in #samha-launch channel.

**Rollback (worst case):**
> We've reverted to the previous version while we investigate an issue with
> v1.0. No data has been lost. Updates in the next 30 minutes.

---

## 6. Known limitations at launch

These are **not** launch blockers but operators should know about them.

- **Phase-D modules disabled:** KYC, Snags, Handover, Construction, Escrow,
  Commission Tiers — flag-gated off. Bookmarks to those routes show 404 / "Not
  available". Schedule for v1.1.
- **Inbound portal email** is not auto-ingested. Bayut / Property Finder /
  Dubizzle leads must be entered manually until v1.1.
- **Late-fee enforcement** is not automatic. Finance team must apply it
  manually in payment records.
- **Frontend role spoofing:** the role chip in the sidebar is sourced from
  `localStorage` and can be edited in dev tools. **It does not bypass server
  authorization** — but visually it looks like the user has more access than
  they do. Document this in `ADMIN_MANUAL.md`.
- **No bulk operations** on `/leads` and `/deals`. Single-record actions only.
- **No saved views.** Filters persist via URL query string only.

(Each of these has a tracking issue in `LAUNCH_READINESS_AUDIT.md` Phase 1 / 2.)

---

## 7. Escalation matrix

| Severity | Definition | Response time | Who |
| --- | --- | :-: | --- |
| SEV-1 | Site down or data loss | 15 min | DevOps + Lead Eng + Director |
| SEV-2 | Major feature broken (auth, payments, deals) | 1 hour | DevOps + Lead Eng |
| SEV-3 | Minor feature broken (single screen / report) | Same day | Lead Eng |
| SEV-4 | Cosmetic / non-blocking | Next sprint | Eng team |

Emergency contacts list — TODO before launch.

---

## 8. Sign-off

| Role | Name | Sign-off | Date |
| --- | --- | --- | --- |
| Lead engineer | | | |
| DevOps owner | | | |
| QA lead | | | |
| Director | | | |

Once all four sign and the T-7 day pre-flight passes, the go-live is approved.
