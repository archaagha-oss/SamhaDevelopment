# Samha CRM — Admin Manual

**Audience.** Org admins, managers, and operations staff.
**Scope.** Configuration, user management, integrations, monitoring, and ops.
For end-user (sales agent) workflows see `USER_MANUAL.md`.

---

## 1. Roles

| Role | Sidebar visibility | Can edit | Can delete | Settings |
| --- | --- | --- | --- | --- |
| **VIEWER** | Read-only on most modules | Nothing | Nothing | Profile only |
| **MEMBER** (sales agent) | Standard sidebar | Their own leads / deals / activities | Nothing destructive | Profile + notifications |
| **MANAGER** | + Reports, agent management for their team | Anything in their team | Soft-delete via deactivation | Most settings |
| **ADMIN** | All sidebar links | Anything | Hard-delete with confirmation | Everything |

> **Note on the role chip in the sidebar.** Today the role label visible in the
> UI is read from `localStorage` (`samha:role`) and **can be edited in browser
> dev tools** to spoof a different role visually. The server-side authorization
> is **not** affected — restricted API calls still return 403. This is documented
> as **D.1.8 (P1)** in `LAUNCH_READINESS_AUDIT.md`. Do not rely on the UI chip
> for security; rely on the API's role enforcement.

---

## 2. Initial setup (post-deploy)

After the app is deployed (per `GO_LIVE_RUNBOOK.md`), an ADMIN performs:

### 2.1 Create the organization

The seed script creates one default Organization. Confirm it's correct —
**Settings → Organization** — and update name / address / TRN.

### 2.2 Invite users

1. **Settings → Users → Invite member**
2. Enter email + role (VIEWER / MEMBER / MANAGER / ADMIN).
3. Click **Send invite**.

The invitee receives a Clerk email link, sets a password, and lands on the home.

For a corporate launch, prepare a CSV of all users in advance and bulk-invite
via **Settings → Users → Bulk import**.

### 2.3 Configure integrations

| Integration | Path | Required env vars |
| --- | --- | --- |
| Clerk auth | (live keys at deploy) | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| AWS S3 (file uploads) | (env at deploy) | `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Twilio (SMS / WhatsApp) | (env at deploy) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` |
| SendGrid (email) | (env at deploy) | `SENDGRID_API_KEY`, `SENDGRID_INBOUND_TOKEN`, `INBOUND_EMAIL_DOMAIN` |
| Sentry (errors) | (env at deploy) | `SENTRY_DSN`, `VITE_SENTRY_DSN` |

After setting env vars and restarting (`pm2 reload`), check
**Settings → Integrations** — each integration shows a status badge:
- **Connected** if env vars are valid and a heartbeat call succeeds
- **Not configured** if env vars are missing
- **Error** with the specific failure message

### 2.4 Configure projects

1. **Projects → New project**
2. Fill in: name, location, completion percentage, handover date, escrow account
   details, default commission rate, RERA registration #.
3. Add **payment plan templates** for the project (e.g., 30/40/30 split).
4. Add **type plans** (1BR, 2BR, etc.) with default specs (area, bath count).

Project setup must happen before agents can create units.

### 2.5 Bulk-load units

1. **Project → Units → Bulk import**
2. Download the CSV template.
3. Fill rows: unit number, type, floor, area, base price, view, etc.
4. Upload — validation happens row-by-row; failures listed inline.

---

## 3. User management

### 3.1 Reassigning leads on staff change

When an agent leaves:

1. **Settings → Users → [agent] → Deactivate**
2. The system prompts: "Reassign their N open leads / M deals to:"
3. Pick the new owner (single user) — or leave unassigned for a manager to
   triage.
4. Confirm. The user record is set to `status = DEACTIVATED` (soft-delete) and
   loses sign-in access immediately.

To **fully erase** a user (PDPL/GDPR right-to-erasure), use **Hard delete**
in the same panel — confirms with re-typed email. This removes the user record
and scrubs PII from audit logs.

> **Note (P1 gap):** there is currently no audit-log entry created on hard
> deletion. Documented in `LAUNCH_READINESS_AUDIT.md` D.2.

### 3.2 Resetting a password

The system uses Clerk for auth. Send the user to the sign-in page → "Forgot
password" — Clerk handles the rest. Admins do not see or set passwords.

### 3.3 API keys

**Settings → API keys** allows creating long-lived API tokens for
integrations (Zapier, custom scripts).

1. Click **New API key** → name it after the integration.
2. The full secret is shown **once** — copy and store securely. Subsequent
   visits show only the last 4 characters.
3. To revoke: click **Revoke** → effective immediately.

API keys do not expire by default. **Recommended:** rotate every 90 days
for production keys. (`LAUNCH_READINESS_AUDIT.md` D.A.4.)

---

## 4. Settings reference

### 4.1 Organization settings

- **Name, address, TRN, default currency** (AED).
- **Bank accounts** (per-project escrow + corporate accounts).
- **Default commission rate** (per project; can override per deal).
- **Late fee policy** (per project; today informational only — see
  `LAUNCH_READINESS_AUDIT.md` Section B gap #2).

### 4.2 Stage SLA configuration

The kanban "stage age" warning thresholds:

| Stage | Default | Setting |
| --- | --- | --- |
| RESERVATION_PENDING | 3 days | Settings → SLAs |
| SPA_PENDING | 7 days | Settings → SLAs |
| OQOOD_PENDING | 14 days | Settings → SLAs |

Above the threshold, the deal card shows a red aging chip. Used by `My Day` to
populate the "deals stalled" metric.

### 4.3 Feature flags

**Settings → Feature flags.** Flags toggle whether the corresponding modules
appear in the UI:

| Flag | Default | Backend ready? |
| --- | --- | --- |
| `kycVerification` | ON | Partial — see `LAUNCH_READINESS_AUDIT.md` C1 |
| `constructionProgress` | OFF | NO — Phase D scaffolding |
| `escrowModule` | OFF | NO — Phase D scaffolding |
| `snagList` | OFF | NO — Phase D scaffolding |
| `handoverChecklist` | OFF | NO — Phase D scaffolding |
| `commissionTiers` | OFF | NO — Phase D scaffolding |

> **At launch, leave all OFF flags OFF.** Turning them on exposes UIs that
> have no working backend. The flags exist so the modules are ready when
> backends ship in v1.1.

### 4.4 Templates

**Settings → Templates.** (Forthcoming — `UX_AUDIT_2_FINDINGS.md` E6.)
For now, message templates are agent-side per-conversation. Org-wide
template management is post-launch.

---

## 5. Integrations & automation

### 5.1 Inbound email (lead capture)

Set up a SendGrid Inbound Parse webhook pointing to:

```
POST https://api.<domain>/api/webhooks/email/inbound/<token>
```

Where `<token>` matches `SENDGRID_INBOUND_TOKEN` in env. Configure
parse hostname `parse.<domain>` and an MX record.

Inbound emails to that domain become **InboundTriage** records visible in the
**Hot Inbox** module (managers + agents). Triage rules:

- If the sender's email matches an existing lead, the message logs as an
  Activity on that lead.
- If unmatched, the message lands in Triage for manual claim.

### 5.2 Twilio webhooks

Configure Twilio Console:

- **WhatsApp inbound** → `https://api.<domain>/api/webhooks/whatsapp/inbound`
- **SMS inbound** → `https://api.<domain>/api/webhooks/sms/inbound`

Both endpoints validate the `X-Twilio-Signature` header against
`TWILIO_AUTH_TOKEN`. **Do not deploy without `TWILIO_AUTH_TOKEN` set in
production** — the middleware silently accepts unsigned requests in dev,
which is unsafe outside dev.

### 5.3 Portal lead emails (Bayut / Property Finder / Dubizzle)

> **At launch, this is not auto-ingested.** The parser exists
> (`apps/api/src/services/portalLeadParserService.ts`) but no inbound webhook
> route is wired to it. Track as gap #1 in `LAUNCH_READINESS_AUDIT.md`. Until
> v1.1, agents enter portal leads manually.

When the route ships, point each portal's auto-forward to the same SendGrid
inbound webhook above. The router will dispatch by sender domain.

---

## 6. Monitoring & ops

### 6.1 Health endpoint

```
GET /health
→ 200 OK { "status": "ok", "timestamp": "..." }
```

Use this for uptime monitoring (UptimeRobot, Pingdom, etc.). Anything other
than 200 → page on-call.

### 6.2 Metrics

```
GET /metrics    (auth-protected with API key)
```

Prometheus exposition format. Scrape at 30-second interval. Key metrics:

- `http_requests_total{status="5xx"}` — error count
- `http_request_duration_seconds_bucket` — latency histogram
- `db_connections_active` — pool utilization
- `sse_clients_connected` — SSE concurrency
- `node_process_resident_memory_bytes` — memory

> **At initial launch the metrics endpoint may not be wired.** Tracked as
> P0 in `LAUNCH_READINESS_AUDIT.md` E.0.2.

### 6.3 Logs

API logs ship to:

- **stdout** (cPanel captures via PM2)
- **`logs/error.log`** — errors only, 10 MB rotation × 5 files
- **`logs/combined.log`** — everything, 20 MB rotation × 10 files

Tail with:

```
pm2 logs samha-api
tail -f /home/<cpanel-user>/apps/api/logs/error.log
```

For incident triage, search `requestId` (added by request-id middleware) to
correlate frontend and backend logs.

### 6.4 Sentry

- **API project:** errors thrown server-side, request context attached.
- **Web project:** unhandled errors caught by `<ErrorBoundary>`, reported with
  user role + URL.

Configure alerts:

- New issue → Slack / email immediately
- Issue volume > 10 / 10 min → page on-call
- Performance regression (p95 > 2× baseline) → daily digest

### 6.5 Backups

Two scripts in `apps/api/scripts/` handle backup and restore. Both read
`apps/api/.env` for `DATABASE_URL` and the optional `BACKUP_*` variables.

#### Daily backup (production cron)

```cron
# crontab -e
0 2 * * * cd /home/<cpanel-user>/apps/api && ./scripts/backup.sh >> logs/backup.log 2>&1
```

**What it does:**

- `mysqldump --single-transaction --routines --triggers --hex-blob` — InnoDB
  consistent snapshot, no table locks.
- `gzip -9` to `apps/api/backups/samha-<dbname>-<UTC-timestamp>.sql.gz`.
- If `BACKUP_S3_BUCKET` is set, uploads to
  `s3://<bucket>/<prefix>/<timestamp>/<file>` with `STANDARD_IA` storage class.
- Prunes local backups older than `BACKUP_RETENTION_DAYS` (default 7) and
  S3 backups older than `BACKUP_S3_RETENTION_DAYS` (default 30).
- Exits non-zero on failure so cron emails / monitoring picks it up.

**Configure** (in `apps/api/.env`):

```
BACKUP_DIR=/home/cpaneluser/apps/api/backups
BACKUP_RETENTION_DAYS=7
BACKUP_S3_BUCKET=samha-prod-backups
BACKUP_S3_PREFIX=samha-backups
BACKUP_S3_RETENTION_DAYS=30
```

The `aws` CLI must be on `$PATH` if you want S3 upload; the script silently
warns and continues with local-only retention if it isn't.

#### Restore (drill or recovery)

```bash
# Monthly drill — restores latest local backup into samha_drill (sandbox DB)
./scripts/restore.sh drill

# Restore a specific file
./scripts/restore.sh drill backups/samha-samha_crm_prod-20260601T020000Z.sql.gz

# Production recovery (requires --force AND typed DB-name confirmation)
./scripts/restore.sh recover backups/<file>.sql.gz --force
```

After restoring, the script prints row counts for `Lead`, `Deal`, `Unit`,
`Payment`, `Activity`, `User`, plus the most-recent activity / payment
timestamps and active-deal count. Compare against production live values to
confirm the restore is consistent within the backup's lag.

#### Drill cadence

Run the drill at least **monthly** (and after any major schema migration).
Treat a drill failure as a P1 incident — your last-known-good backup might
also be corrupt.

---

## 7. Audit log

**Settings → Audit log** shows immutable records of:

- Member create / deactivate / hard-delete
- API key create / revoke
- Settings changes (org config, SLA config, integrations)
- Stage SLA edits
- Payment writes (separate `PaymentAuditLog`)
- Status changes (separate `StatusHistory`, `LeadStageHistory`)

Filter by user, action type, date range. Export as CSV for compliance review.

> **Gap:** lead deletion, contact deletion, and hard user deletion don't
> currently emit audit-log entries. P2 in `LAUNCH_READINESS_AUDIT.md` D.2.

---

## 8. Compliance

### 8.1 RERA license tracking

**Brokers → Compliance** shows broker companies and agents with RERA licenses
expiring within 30 / 60 / 90 days. Renew the license, scan the new copy,
upload via the broker detail page, update expiry date.

### 8.2 PDPL (UAE data protection)

Things you must know for compliance:

- **PII in the system:** name, phone, email, EID, passport number, address,
  source-of-funds, photos, IDs.
- **Data residency:** the prod database lives in <region>. Confirm in your
  contract that this satisfies any tenant's residency requirement.
- **Right to access:** export a contact's record via **Contacts → [contact]
  → Export** (forthcoming — manual SQL until that ships).
- **Right to erasure:** delete the contact + all linked leads. Cascade
  deletes ensure no orphan PII. Activities (which contain message bodies) go
  with the lead.
- **Subject access requests** are typically fulfilled within 30 days. Track
  in your support system.

> **Gap (P2):** there is no dedicated `/api/users/:id/erase` endpoint that
> bundles the steps. Tracked in `LAUNCH_READINESS_AUDIT.md` D.2.

### 8.3 Audit retention

Audit logs are retained indefinitely (no auto-purge). Backups retained 30
days. Adjust per your industry policy.

---

## 9. Routine ops

### 9.1 Daily

- Review **Hot Inbox** for unclaimed inbound messages.
- Scan **Sentry** for new errors.
- Confirm **/health** returns 200.

### 9.2 Weekly

- Review **Audit log** for unexpected admin actions.
- Run **MANUAL_QA_CHECKLIST.md** "Smoke Tests" section.
- Check disk usage; rotate `logs/` if approaching 70% disk.

### 9.3 Monthly

- **Restore drill** — backup → sandbox DB → verification queries.
- **Rotate API keys** issued more than 90 days ago.
- **Review feature flags** — turn off any that are still on by accident.
- **License renewals** — RERA, Trade License, VAT certificates due in 60 days.

### 9.4 Quarterly

- **Access review** — for each user, confirm they still need their role.
- **Dependency audit** — `npm audit` in both workspaces; address P0/P1 CVEs.
- **PDPL review** — ensure data-handling practices match policy.

---

## 10. Troubleshooting

### 10.1 An agent can't sign in

1. Confirm their user record in **Settings → Users** has `status = ACTIVE`.
2. Confirm their email matches the Clerk session email.
3. Send them the Clerk "Forgot password" link.

### 10.2 A WhatsApp message isn't delivering

1. Check **Activity timeline** on the lead — `deliveryStatus` should progress
   queued → sent → delivered → read.
2. If stuck at `queued`: Twilio outage. Check status.twilio.com.
3. If `failed`: open the activity to see the error code; Twilio's docs map
   codes → causes.
4. Ensure `TWILIO_WHATSAPP_FROM` is opted in for the recipient's region.

### 10.3 A document fails to generate

1. Check `logs/error.log` for the request ID.
2. Common causes: missing fields on the deal/unit (e.g. no payment plan), S3
   credentials invalid, PDF library OOM.
3. After fixing, re-trigger from the deal detail (it's idempotent — won't
   create duplicates).

### 10.4 The bell doesn't update in real time

1. Check that `/api/stream` returns SSE headers (curl -I).
2. Behind cPanel: confirm the proxy doesn't buffer SSE responses (set
   `proxy_buffering off` in the relevant config).
3. Fall back to the 5-min poll if SSE is unavailable.

### 10.5 Reports are slow

1. Run with a tighter date range first.
2. Check `EXPLAIN` on the underlying query (find it in `routes/reports.ts`).
3. Add the missing index if needed (`LAUNCH_READINESS_AUDIT.md` E.1.3).

---

## 11. Escalation

| Issue | First contact | Second |
| --- | --- | --- |
| App down (5xx storm) | Lead engineer | Director |
| Data corruption suspected | Lead engineer **immediately** | DevOps |
| Twilio / SendGrid outage | Comms lead | Twilio / SendGrid support |
| Clerk auth issue | DevOps | Clerk support |
| Database issue | DevOps | Hosting provider |

For severities and response times see `GO_LIVE_RUNBOOK.md §7`.
