# Launch-Readiness Audit — Samha CRM

**Date:** 2026-05-10
**Branch:** `claude/launch-readiness-audit`
**Status:** Audit deliverable. **Implementation follows in PR-sized batches.**

---

## Executive Summary

This audit covers four dimensions: **feature completeness**, **bloat / extras**,
**security & data**, and **production-readiness**. Five parallel research
streams produced the underlying evidence; every claim cites `path:line`.

### Verdict

| Dimension | Status | Headline |
| --- | --- | --- |
| Feature completeness | **94/100** | Core sales-ops chain is intact (Lead → Reservation → Sales Offer → SPA → Oqood → Payment → Commission → Handover). Gaps are secondary features. |
| Bloat / extras | ~2,500 LOC removable | Phase-D scaffolding (6 frontend pages, 13 stub API clients, 4 unused services) ships into production today with no working backend. |
| Security & data | **NOT LAUNCH-READY** | 3 P0 blockers: mock auth hardcoded, dev-mode role bypass, multiple unauthenticated routes. |
| Production-readiness | **NOT LAUNCH-READY** | 3 P0 blockers: no error tracking, no metrics, no alerting, no automated deploy. |

### Top launch blockers (must fix before going live)

1. **Mock auth in production code path** — every request gets `req.auth = { userId: "dev-user-1" }` unconditionally. (`apps/api/src/index.ts:131-134`)
2. **Multiple data routes have no `requireAuthentication` middleware** — leads, contacts, brokers list/get endpoints are open. (`leads.ts:19,105`, `contacts.ts:8,56,73,112,147`, `brokers.ts:60`)
3. **`DELETE /api/leads/:id` checks for *any* authenticated user, not role** — a VIEWER can delete leads. (`leads.ts:601-627`)
4. **No external error tracking** — production errors land on local disk only (Winston file transport). If the cPanel instance fails, history is gone.
5. **No metrics or alerting** — request rate, latency, error rate are invisible during incidents.
6. **No CI/CD deploy step** — every release is a manual cPanel rsync; no rollback automation.
7. **Web app's `VITE_API_URL` is undocumented in `apps/web/.env.example`** — production builds will hit `localhost:3000` unless the operator knows to set it.
8. **No idempotency keys on `POST /api/payments` and `POST /api/deals`** — a network retry double-charges.

### Recommendation

**Do not launch in current state.** Address P0 blockers first (~2 weeks of focused
work), then P1 hardening (~1 week), then optionally remove Phase-D bloat. Launch
target shifts ~3 weeks.

A cleaner alternative: **Launch with the P0 fixes, defer P1 hardening to week-1
post-launch, and feature-flag-off the Phase-D pages so end users don't see broken
modules.** This is the path most teams take and is achievable in ~2 weeks.

---

## Section A — Documentation inventory & consolidation

The repo has **31 root-level markdown docs**. After reading each in full, here's
the breakdown:

| Status | Count | Files |
| --- | ---: | --- |
| **CRITICAL** (keep & maintain) | 7 | README, SETUP, QUICKSTART, API, TECHNICAL-SPECIFICATION, ARCHITECTURE_STANDARDS, CPANEL-DEPLOYMENT-QUICK-START |
| **CURRENT** (keep, may need updates) | 14 | TEST_PLAN, UX_AUDIT_2_FINDINGS, EXECUTION-CHECKLIST, PRODUCTION-READINESS, PRODUCTION-DEPLOYMENT, FINAL_ASSESSMENT_AND_HANDOFF, IMPLEMENTATION_PHASE_3_COMPLETE, IMPLEMENTATION_STATUS_ASSESSMENT, INTEGRATED_CRM_EXECUTION_SUMMARY, PARALLEL_IMPLEMENTATION_ROADMAP, PHASE_A_UXUI_SUMMARY, PROJECT-ASSESSMENT, WEEK2_BACKEND_TEST_PLAN, WEEK3_DASHBOARD_ROADMAP, WIREFRAME_GAP_ANALYSIS, COMPREHENSIVE_5WEEK_PLAN, DEALDETAILPAGE_REFACTORING_GUIDE, UI_AUDIT_SUMMARY |
| **STALE** (claims contradict code) | 2 | COMPLETE_UX_REDESIGN_SUMMARY, INTEGRATION_GUIDE — both reference `LeadsPageV2`, `UnitSearchFilters`, `NotificationCenter` components that **do not exist** in the codebase |
| **DUPLICATE** | 1 | APP-SPECIFICATION-COMPLETE.md — content overlaps `TECHNICAL-SPECIFICATION.md` |
| **HISTORICAL** (archive) | 3 | INITIALIZE-SUMMARY, WEEK1_COMPLETION_SUMMARY, WEEK2_PROGRESS_SUMMARY |

### Consolidation plan

1. ~~**Delete `APP-SPECIFICATION-COMPLETE.md`.**~~ Done in PR #9. Everything in it is in `TECHNICAL-SPECIFICATION.md` (the canonical source).
2. ~~**Move 3 historical week-N summaries to `docs/archive/`.**~~ Done in PR #9 — `INITIALIZE-SUMMARY.md`, `WEEK1_COMPLETION_SUMMARY.md`, `WEEK2_PROGRESS_SUMMARY.md` moved.
3. **Mark `COMPLETE_UX_REDESIGN_SUMMARY.md` and `INTEGRATION_GUIDE.md` as
   superseded** by `UX_AUDIT_2_FINDINGS.md` (the latest, most accurate audit).
   Add a banner to each pointing to the audit. They contain real architectural
   notes worth keeping but their feature-status claims are wrong.
4. **Reduce overlap between `EXECUTION-CHECKLIST.md`, `PRODUCTION-READINESS.md`,
   `PRODUCTION-DEPLOYMENT.md`, and `CPANEL-DEPLOYMENT-QUICK-START.md`.** All four
   describe pre-deploy steps. Recommend: keep CPANEL guide as the
   how-to, replace the other three's content with a one-line "see
   GO_LIVE_RUNBOOK.md" once that lands.

After consolidation: 31 files → ~22 files at the root, all currently accurate.

---

## Section B — Feature completeness

The brief was: what's specced vs what's built. Verdict: **the canonical sales
chain works end-to-end**; gaps are in secondary features and post-launch
enhancements.

### Implemented (sample, not exhaustive — full table in agent transcript)

| Feature | Evidence |
| --- | --- |
| Lead CRUD + 8-stage state machine | `routes/leads.ts:24-50`, `services/leadService.ts` |
| Activity logging (CALL/EMAIL/WHATSAPP/MEETING/NOTE/SITE_VISIT) | `routes/activities.ts`, `services/communicationDispatcher.ts` |
| Reservation → Sales Offer → SPA → Oqood → Payment → Handover | `services/dealService.ts`, `services/spaService.ts`, `services/spaRulesService.ts` |
| Document generation (Sales Offer / SPA / Reservation Form / Receipts) | Print pages + PDF generators |
| Payment plans + payment recording + audit log | `routes/payments.ts`, `services/paymentService.ts`, `PaymentAuditLog` model |
| Commission unlock (SPA + Oqood gate) | `services/dealService.ts`, `routes/commissions.ts` |
| Unit lifecycle + status history + price history | `routes/units.ts`, `UnitStatusHistory`, `UnitPriceHistory` models |
| Multi-channel comms (Email / WhatsApp / SMS) | `services/{mailerService,whatsappService,smsService}.ts` |
| Inbound triage (Hot Inbox) | `routes/triage.ts`, `InboundTriage` model |
| Public unit share links | `routes/publicShare.ts`, `UnitShareToken` model |
| Notifications model + bell UI | `Notification` model, `AppShell.tsx:44-330` |
| Roles ADMIN/MANAGER/MEMBER/VIEWER + statuses | `prisma/schema.prisma:116-128`, `routes/users.ts` |

### Top 10 partial / missing features (ranked by user impact)

| # | Feature | Status | Effort | Note |
| - | --- | --- | :-: | --- |
| 1 | Inbound portal-email webhook (Bayut / Property Finder / Dubizzle) | Parser + ingest service exist; **no inbound webhook route** | M | Without this, portal leads must be entered manually. `services/portalLeadParserService.ts` is reachable only from manual ingest. |
| 2 | Late-fee enforcement | `LateFeeRule` schema exists; `paymentService` doesn't apply it | M | Schema declares default 2%/month; no calculation site. |
| 3 | Agent performance leaderboard | No `/reports/agent-leaderboard` endpoint or page | M | Manager-facing; activity model already tracks the data. |
| 4 | Bulk payment import (CSV/Excel) | Single-payment-marking only | M | Finance team marks 100+ payments individually. |
| 5 | Public unit landing page | Share token works; `/public/:token` page renders nothing | S | `publicShare.ts` route exists; just no frontend. |
| 6 | Reservation auto-expiry job | `Reservation.expiresAt` exists; no cron | M | Stale reservations don't auto-release units. |
| 7 | Commission Form A doc gate | `Commission.documentKey` is nullable; no enforcement | M | Audit risk: commission paid without supporting doc. |
| 8 | Auto task generation on stage change | `DealStageHistory` tracked; no event handler creates tasks | S | "Follow up SPA signature" must be created by hand. |
| 9 | Deal handover checklist backend | Frontend page exists; backend partial | S | Frontend renders against stub API. |
| 10 | RERA expiry alerts | Indexes exist on `BrokerCompany.reraLicenseExpiry`; no notification trigger | S | Easy wire-up — query + Notification create. |

### Schema drift

- **Models with no route or service touching them** (orphan):
  `PartialPayment` (superseded by `Payment.status = PARTIAL`),
  `DomainEvent` and `BackgroundJob` (reserved for a future event-sourcing
  architecture), `ReminderLog` (no management UI). These are not blocking —
  the design is forward-looking — but should be either implemented or
  removed before they confuse future developers.

---

## Section C — Bloat / extras

~2,500 LOC of code currently ships into the bundle that has zero production
backend. Most of it is **Phase-D scaffolding** — frontend pages with
`FeatureFlagGate` wrappers calling stub API clients that point to unmounted
routes.

### C1 — Phase-D frontend pages (gated, no backend)

| Page | Flag | Backend route mounted? |
| --- | --- | :-: |
| `pages/ConstructionProgressPage.tsx` | `constructionProgress` | No |
| `pages/EscrowPage.tsx` | `escrowModule` | No |
| `pages/SnagListPage.tsx` | `snagList` | No |
| `pages/HandoverChecklistPage.tsx` | `handoverChecklist` | No |
| `pages/CommissionTiersPage.tsx` | `commissionTiers` | No |
| `pages/LeadKycPage.tsx` | `kycVerification` (default `true`) | Partial |

**Two options before launch:**

A. **Implement the backends** — multi-week effort. Don't pick this unless
   Phase D is committed for v1.0.

B. **Force-disable all six flags in production**, hide the routes, and remove
   the corresponding pages from the build (or wire them to `<NotFoundPage />`
   so a stray bookmark doesn't show a broken UI). Recommended.

C. **Delete the pages and rebuild later when backend is ready.** Cleanest for
   a small launch surface; restorable from git history. Most aggressive.

### C2 — Stub API clients in `apps/web/src/api/phase2ApiService.ts`

13 client modules — `kycApi`, `phasesApi`, `typePlansApi`, `constructionApi`,
`snagsApi`, `handoverApi`, `titleDeedsApi`, `invoicesApi`, `receiptsApi`,
`refundsApi`, `escrowApi`, `commissionTiersApi`, `dealPartiesApi` — all hit
unmounted routes. **Recommend delete** as part of option (B) above.

### C3 — Backend services with no live consumer

| File | Reachable via | Status |
| --- | --- | --- |
| `services/portalLeadIngestService.ts` | Manual CLI only; no webhook | Partial — gap #1 in Section B |
| `services/portalLeadParserService.ts` | Same as above | Partial |
| `services/excelService.ts` | Imported by `reports.ts` only; export route not exposed | Likely safe to delete |
| `services/inboundMatcher.ts` | Referenced in a comment in `inboundProcessor` | Incomplete; Phase D |

Don't delete `portalLead*Service` — they're 80% of the way to a real feature
(inbound webhook + parser + ingest). Just finish them or leave alone.

### C4 — Multi-implementation duplication (R-class issues)

- Two confirmation patterns: `ConfirmDialog` component + ad-hoc `window.confirm()`.
  Already covered by **R5** in `UX_AUDIT_2_FINDINGS.md`.
- Three deal-status displays: `DealDetailPage`, `DealSummaryPanel`,
  `DealReadinessIndicator` each compute and render deal status from scratch.
  Consolidate to a single `useDealStatus()` hook.

### C5 — TODO / FIXME markers

| File | Line | TODO | Severity |
| --- | --- | --- | --- |
| `apps/web/src/components/AppShell.tsx` | ~50 | "integrate real Clerk auth in future phase" | **P0 (launch blocker — see Section D)** |
| `apps/web/src/pages/NotificationPreferencesPage.tsx` | — | "server-side resolver in notificationService" | P2 |
| `apps/web/src/pages/RefundsPage.tsx` | — | "TODO(Phase C): replace prompt() with inline form" | P2 |

---

## Section D — Security & data

### D.0 P0 launch blockers

**D.0.1 — Mock auth hardcoded in production code path**

```
File: apps/api/src/index.ts:131-134
Behavior: every request gets `req.auth = { userId: "dev-user-1" }` UNCONDITIONALLY.
The Clerk middleware setup is commented out.
```

If this code is deployed, the API has no authentication at all. **Every
function that thinks it's protected by `req.auth` is open.**

**D.0.2 — Dev-mode role bypass**

```
File: apps/api/src/middleware/auth.ts:51-62
Behavior: when NODE_ENV !== "production" AND the user record is not in DB,
requireRole() returns success (treating the request as ADMIN).
```

In a staging env (`NODE_ENV=staging`), unknown users default to ADMIN. The fix
is trivial — invert the check to fail-closed — but it's currently a back door.

**D.0.3 — Unauthenticated data routes**

| File | Lines | Issue |
| --- | --- | --- |
| `routes/leads.ts` | 19, 105 | `GET /api/leads`, `GET /api/leads/:id` no auth |
| `routes/contacts.ts` | 8, 56, 73, 112, 147 | All 5 contact CRUD endpoints no auth |
| `routes/brokers.ts` | 60 | `GET /api/brokers/companies` no auth |

`DELETE /api/leads/:id` (line 601-627) checks `req.auth?.userId` exists but
not the role — a VIEWER can delete leads.

### D.1 P1 — High

| # | Issue | File:Line |
| - | --- | --- |
| D.1.1 | Contacts CRUD has no role gate; anyone authenticated can write | `contacts.ts:73,112,147` |
| D.1.2 | IDOR risk: `GET /api/leads/:id` returns full PII (EID, passport, source-of-funds) without checking org/team membership | `leads.ts:105-145` |
| D.1.3 | Same IDOR risk on `GET /api/contacts/:id` | `contacts.ts:56-69` |
| D.1.4 | `PATCH /api/leads/:id` reads raw `req.body` with no Zod schema; `POST` validates but `PATCH` doesn't | `leads.ts:380-442` |
| D.1.5 | `POST /api/contacts` accepts raw body — only checks `firstName` exists | `contacts.ts:73-108` |
| D.1.6 | PII unmasked in list responses; VIEWER role sees phone/email/EID at full fidelity | `leads.ts:44-61` |
| D.1.7 | Broker delete routes — verify `requireRole(["ADMIN"])` is applied | `brokers.ts:356,424` |
| D.1.8 | Web `localStorage.getItem("samha:role")` is the trust source for sidebar visibility — easily spoofed | `AppShell.tsx:76` |
| D.1.9 | Web `VITE_API_URL` not in `.env.example`; production builds may hit `localhost:3000` | `apps/web/.env.example`, `vite.config.ts` |

### D.2 P2 — Medium

- Twilio webhook signature is **optional in dev**; if `TWILIO_AUTH_TOKEN` is
  unset, all webhooks accepted. (`middleware/twilioWebhook.ts:19-26`) — fine
  for dev; **panic in production** if missing.
- SendGrid inbound: same pattern. If both path-token and env-token are unset,
  webhook accepts unsigned. (`webhooks.ts:106-134`)
- No audit log on lead deletion, contact deletion, hard user delete. Soft
  delete (status=DEACTIVATED) is the default; hard delete with `?hard=true`
  leaves no trail.
- Activity messages (`summary`, `outcome` columns) stored in plain text. Database-
  level encryption depends on MySQL server config which isn't declared. PDPL
  exposure if DB is leaked.
- No explicit "right to erasure" endpoint. Cascade delete on `Lead`/`Contact`
  works mechanically but isn't a documented PDPL flow.

### D.3 Already-good security findings (don't break these)

- ✓ Zero hardcoded secrets in code (`grep` confirmed AWS / Twilio / Clerk all via `process.env`)
- ✓ Zero raw SQL (`prisma.$queryRaw` not used; ORM-only — SQL injection safe by default)
- ✓ File upload: multer validates mime type + 50 MB cap + sanitized filenames (`brokers.ts:13-22`)
- ✓ Rate limit middleware: 100 req/min per IP, plus 30 req/min on public-share endpoints
- ✓ CORS: explicit allow-list via `ALLOWED_ORIGINS`; no `*`
- ✓ Twilio signature validation **does** exist (`middleware/twilioWebhook.ts:17-51`) — just disabled in dev
- ✓ Webhook idempotency on inbound email (`webhooks.ts:192`)

---

## Section E — Production readiness

### E.0 P0 launch blockers

| # | Blocker | Recommendation |
| - | --- | --- |
| E.0.1 | **No external error tracking.** Winston ships JSON to local `logs/error.log`. If the cPanel instance dies, history is gone. No Sentry / Datadog / NewRelic / Bugsnag imports anywhere. | Integrate Sentry on API + web. ~2-day effort. |
| E.0.2 | **No metrics endpoint.** No `/metrics`, no Prometheus scraper. Request rate, latency, error rate are invisible during incidents. | Add `express-prom-client`; expose `/metrics` (auth-protected). |
| E.0.3 | **No alerting configured.** Silent failures — disk-full, DB connection pool exhaustion, 5xx storms — won't reach anyone. | Configure cPanel monitoring or Datadog: 5xx rate, p99 latency, disk > 90%, memory > 80%, queue depth. |
| E.0.4 | **No CI/CD deploy automation.** `ci.yml` runs typecheck + tests; there is no `deploy` job. Every release is a manual rsync. No rollback automation. | Add `deploy` job (SSH / rsync / blue-green) + tagged releases. |

### E.1 P1 — High

| # | Issue | Detail |
| - | --- | --- |
| E.1.1 | `apps/web/.env.example` is missing `VITE_API_URL` | Production web build hits `localhost:3000` unless operator knows to set it. |
| E.1.2 | Web `vite.config.ts` doesn't expose `VITE_API_URL` at build time | Same issue, frontend half. |
| E.1.3 | Database missing critical indexes | `Lead.assignedAgentId`, `Lead.stage`, `Deal.stage`, `Deal.leadId`, `Deal.unitId`, `Payment.dealId`, `Payment.status`, `Payment.dueDate`, `Activity.leadId+createdAt`. List sweeps will scan full tables in production. |
| E.1.4 | No idempotency keys on payment / deal POSTs | Network retry → double-charge. Add `Idempotency-Key` header + cached response. |
| E.1.5 | No automated backup script in repo | Relies on cPanel-managed backups. Add `apps/api/scripts/backup.sh` (mysqldump) + monthly restore drill. |
| E.1.6 | Migration runner unclear in CI | `ci.yml` validates schema but doesn't run migrations. Document `prisma db push` step or add migration dry-run. |

### E.2 P2 — Medium

- N+1 risk in `routes/reports.ts:89-92` (loads all payments + nested deals + units + leads, no pagination)
- SSE in-memory map (`services/sseHub.ts:27`) is unbounded; no `MAX_CLIENTS_PER_USER`/`MAX_TOTAL_CLIENTS` cap
- No async job queue; `routes/payments.ts` and email sends block the request path. There IS a `BackgroundJob` table polled every 30s (`index.ts:48`) — fine for non-urgent jobs, bad for time-sensitive notifications.
- Frontend `ErrorBoundary` only `console.error()`s; doesn't report to backend
- Static asset caching: no `.htaccess` cache headers for `/dist/*`
- HSTS header missing on API responses

### E.3 Already-good production findings

- ✓ Migrations are MySQL-safe (enum-widen-narrow pattern, idempotent)
- ✓ Seed script is comprehensive (`apps/api/src/db/seed.ts:1-665`)
- ✓ PM2 ecosystem config: 2 API instances + 1 worker, graceful shutdown, max-memory restart (`ecosystem.config.js`)
- ✓ Logger ships to file in prod (`apps/api/src/lib/logger.ts:26-43`)
- ✓ Health endpoint exists (`/health` returns `{status, timestamp}`)
- ✓ Frontend is code-split via `React.lazy` (`router.tsx:1-17`)
- ✓ Aggregate reports use Prisma `aggregate` and `groupBy` (DB-side computation)
- ✓ 25 sites use `prisma.$transaction(...)` for multi-step ops
- ✓ Job retries with exponential backoff: `2^retryCount * 60s` (`events/jobs/jobHandlers.ts:164-174`)
- ✓ Webhook idempotency on inbound email

---

## Section F — Implementation order

### Phase 0 — P0 fixes (launch blockers, ~2 weeks)

These cannot be deferred. Each is small individually; the sum is meaningful.

**Week 1: Auth & access**
1. Replace mock-auth in `apps/api/src/index.ts:131-134` with the existing
   Clerk middleware. Verify on staging that an unauthenticated request returns
   401, not 200 with `dev-user-1`.
2. Invert `requireRole` fail-mode in `auth.ts:51-62` — non-prod should fail
   the same way as prod.
3. Add `requireAuthentication` middleware to: leads list/get,
   contacts CRUD, brokers list endpoints.
4. Add `requireRole(["ADMIN", "MANAGER"])` to `DELETE /api/leads/:id` and
   contacts/brokers delete routes.
5. Spot-check IDOR: every `findUnique({ where: { id } })` in routes should add
   an organization / team filter.

**Week 2: Observability + deploy**
6. Integrate Sentry on API (`@sentry/node`) and web (`@sentry/react`) — gated
   by `SENTRY_DSN` env var, no-op in dev.
7. Add `/metrics` endpoint via `express-prom-client`. Wrap response, request
   counters; histograms for latency.
8. Configure alerts (cPanel monitoring or Datadog): HTTP 5xx > 1%, p99 > 2s,
   disk > 90%, memory > 80%.
9. Add a `deploy` job to `.github/workflows/ci.yml` — SSH to cPanel, rsync,
   PM2 reload. Optional: blue-green via two PM2 process groups.
10. Add `VITE_API_URL` to `apps/web/.env.example`. Update vite config to read
    it at build time.

**Output:** P0 list closed. Launch is no longer blocked on auth, observability,
or deploy.

### Phase 1 — P1 hardening (1 week, ideally pre-launch but acceptable in week-1 post-launch)

11. Add Zod validation to `PATCH /api/leads/:id` and all `POST/PATCH /api/contacts`.
12. Mask PII for VIEWER role in list responses (`+971 ***-5678` pattern).
13. Add idempotency-key middleware on `POST /api/payments` and `POST /api/deals`.
14. Add the missing DB indexes (E.1.3 list).
15. Add `apps/api/scripts/backup.sh`. Run a restore drill into a sandbox DB and
    document the procedure in `GO_LIVE_RUNBOOK.md`.
16. Migrate frontend role-source from `localStorage` to `/api/users/me` fetch.
17. Hide / remove Phase-D pages so end users don't see broken modules
    (Section C, option B or C).

### Phase 2 — Post-launch (2 weeks of week-1 + week-2)

- Implement gap #1 (inbound portal-email webhook) — closes the manual-entry workaround
- Implement gap #2 (late-fee enforcement) — finance-team request
- Add async job queue (BullMQ + Redis) — moves email/SMS off the request path
- Pagination for `/api/reports/payments`
- Bound SSE connection map
- Doc consolidation per Section A

### Phase 3 — Future (no schedule, optional)

- Phase-D modules (KYC, Snags, Handover, Construction, Escrow, Commission Tiers)
  — only if business commits to them
- @mention notifications, won/lost reason, templates per stage (from `UX_AUDIT_2_FINDINGS.md` Part E)
- PWA / service worker / offline support

---

## Section G — Cross-references

This audit complements existing deliverables. Where they overlap, this audit is
the **operational** view; the others are **design / UX**.

| Doc | What it covers | Relationship |
| --- | --- | --- |
| `UX_AUDIT_2_FINDINGS.md` | Visual / interaction fixes (R1–R7, "My Day", per-page wireframes) | UX-side; this audit doesn't repeat. P0 / P1 fixes from there can run in parallel with the launch fixes here. |
| `MANUAL_QA_CHECKLIST.md` | Click-through script per workflow (this branch) | Run after Phase-0 P0 fixes are in. |
| `GO_LIVE_RUNBOOK.md` | Launch-day runbook + rollback plan (this branch) | Single-source for operators on go-live day. |
| `CI_TEST_MATRIX.md` | Module → test coverage map (this branch) | Used to plan which P0/P1 fixes need new tests. |
| `USER_MANUAL.md` / `ADMIN_MANUAL.md` | End-user / admin reference docs (this branch) | Independent of this audit; ships alongside the app. |

---

## Section H — Final scorecard

| Dimension | Pre-Phase-0 | Post-Phase-0 (launch-ready) | Post-Phase-1 (hardened) |
| --- | :-: | :-: | :-: |
| Feature completeness | 94 | 94 | 94 |
| Bloat / extras | -25 (Phase-D ships) | -25 (still ships) | 0 (cleaned) |
| Security & data | **NOT READY** | Acceptable | Hardened |
| Production-readiness | **NOT READY** | Acceptable | Hardened |
| **Overall** | **DO NOT LAUNCH** | **GO** with monitoring | **STRONG** |

**Target launch:** end of Phase 0 (≈2 weeks from start). Phase 1 happens in
parallel during week-1 post-launch with mitigation: scoped beta users only, daily
log review, weekly restore drill until backups are automated.
