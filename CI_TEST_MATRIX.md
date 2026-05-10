# CI / Test Matrix — Samha CRM

**Purpose.** Map every module to its current test coverage and flag the
**gaps that must close before launch**. Living document — update each sprint.

**Tooling.** API uses Vitest (`apps/api && npm test`). Web has no tests today.
CI workflow at `.github/workflows/ci.yml`.

---

## Coverage by module — backend

| Module | Service file | Route file | Test file(s) | Coverage | Priority gap |
| --- | --- | --- | --- | --- | --- |
| Lead lifecycle | `leadService.ts` | `routes/leads.ts` | none | **NONE** — relies on dealLifecycle test | **P0** Add `leadService.test.ts` for create / stage transitions / duplicate-phone / contacts auto-mirror |
| Deal lifecycle | `dealService.ts` | `routes/deals.ts` | `__tests__/deal-lifecycle.integration.test.ts` | Integration test exists | OK; extend with cancellation + idempotency |
| Payments | `paymentService.ts` | `routes/payments.ts` | none | **NONE** | **P0** Add for partial payments, audit log writes, late fee (once implemented) |
| Commissions | (in `dealService.ts`) | `routes/commissions.ts` | covered indirectly by deal-lifecycle | Partial | **P1** Add explicit unit tests for unlock gates (SPA + Oqood) |
| Reservations | `reservationService.ts` | `routes/reservations.ts` | none | **NONE** | **P1** Add for reservation expiry + auto-release |
| Documents (PDF gen) | `documentService.ts`, `spaService.ts`, `spaRulesService.ts` | `routes/documents.ts` | none | **NONE** | **P1** Add snapshot tests for SPA / Sales Offer / Receipt PDFs |
| Communications | `mailerService.ts`, `whatsappService.ts`, `smsService.ts`, `communicationDispatcher.ts` | `routes/communications.ts` | none | **NONE** | **P1** Add channel-picker test (covers opt-out logic) |
| Communication preferences | `communicationPreferenceService.ts` | (within leads / contacts) | `__tests__/communicationPreference.test.ts` | Test exists | OK |
| Inbound triage | `inboundProcessor.ts`, `inboundMatcher.ts` | `routes/triage.ts`, `routes/webhooks.ts` | `__tests__/inboundProcessor.test.ts`, `__tests__/inboundMatcher.test.ts` | Test exists | OK; add webhook signature-failure test |
| Portal lead parsing | `portalLeadParserService.ts` | (no live route — gap) | `__tests__/portalLeadParser.test.ts` | Test exists | **P1** Add ingest service test once webhook route exists |
| Phone normalization | `lib/phone.ts` | n/a | `__tests__/phone.test.ts` | Test exists | OK |
| Contacts | `contactService.ts` | `routes/contacts.ts` | none | **NONE** | **P0** Add `contactService.test.ts` for auto-mirror upsert + idempotency |
| Units | `unitService.ts` | `routes/units.ts` | none | **NONE** | **P1** Add status-transition tests + bulk-import validation |
| Pricing | `pricingService.ts` | (within deals/units) | none | **NONE** | **P2** Add per-sqft / discount math tests |
| Compliance | `complianceService.ts` | `routes/compliance.ts` | none | **NONE** | **P2** Add RERA-expiry alert tests |
| Public share | `shareTokenService.ts` | `routes/publicShare.ts` | none | **NONE** | **P1** Add token-expiry + revoke tests |
| Excel export | `excelService.ts` | (not mounted) | none | **NONE** | Defer — service is currently dead per Bloat audit |
| Auth middleware | `middleware/auth.ts`, `middleware/apiKeyAuth.ts` | n/a | none | **NONE** | **P0** Add tests for `requireAuthentication`, `requireRole` (and the dev-mode bypass — guard against regression) |
| Twilio webhook signature | `middleware/twilioWebhook.ts` | n/a | none | **NONE** | **P0** Add test that asserts signature validation rejects unsigned in production |
| Rate limiter | `index.ts:76-106` (inline) | n/a | none | **NONE** | **P2** Extract to module + test |
| SSE hub | `services/sseHub.ts` | `routes/stream.ts` | none | **NONE** | **P2** Add register/unregister + max-clients tests |

### Schema / migrations

| Item | Test status | Priority gap |
| --- | --- | --- |
| Prisma schema validation | ✓ runs in CI (`npx prisma validate`) | OK |
| Migration idempotency | none | **P1** Add CI step that applies all migrations to a fresh MySQL container, then re-applies — must succeed |
| Seed runs cleanly | none | **P2** Add CI step `npm run db:seed` against fresh DB |

---

## Coverage by surface — frontend

| Surface | Files | Test files | Coverage |
| --- | --- | --- | --- |
| All web routes / components | `apps/web/src/**/*.tsx` | **none** | **0%** |

Web has zero tests today. Vitest + React Testing Library is the recommended
addition. Priorities for first round:

| # | Surface | Test type | Priority |
| - | --- | --- | --- |
| 1 | `LeadProfilePage` smoke render with mock data | RTL render | P1 |
| 2 | `DealDetailPage` smoke render | RTL render | P1 |
| 3 | `formatCurrency` / future `formatDirham` utility | unit | P0 (after R3 lands) |
| 4 | `ConfirmDialog` open/close behavior | RTL interaction | P2 |
| 5 | `useUrlFilters` hook (once built) | unit | P2 |

---

## CI workflow — current state

**File.** `.github/workflows/ci.yml`

**Triggers:** push and pull_request on `master` and `main` (after the fix in
this branch). Old workflow only triggered on `main` — which is not the default
branch — so most PRs ran no checks.

**Steps (in order):**

1. Checkout
2. Node.js 20 + npm cache
3. `npm ci` at root
4. `npm install` in `apps/api` and `apps/web`
5. `npx prisma validate`
6. `npx prisma generate`
7. **API typecheck** with grep filters for known pre-existing errors (jobHandlers, swagger-ui-express types, auditDataIntegrity)
8. **Web typecheck** with grep filter for `TS6133` unused-vars
9. **API tests** — `npm test --prefix apps/api --if-present`
10. **API lint** — `continue-on-error: true` initially (informational only)
11. **Web lint** — same
12. **API build** — fail-on-error
13. **Web build** — fail-on-error, with placeholder `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY`

**Known issues to track for follow-up PRs:**

- Grep filters in steps 7–8 paper over real type errors. The pre-existing
  errors should be fixed and the filters removed. Tracked as **P2**.
- No deploy job. Adding cPanel SSH/rsync deploy on tagged release is **P0**
  per `LAUNCH_READINESS_AUDIT.md` E.0.4.
- Tests don't run against a real MySQL container — they use mocked DB. For
  integration coverage, add a service container.
- No coverage reporting (`vitest --coverage`). Add when tests grow past the
  current 6 files.

---

## Recommended additions (next 3 sprints)

### Sprint 1 — close P0 gaps before launch

```yaml
# Add these jobs/steps to ci.yml

  - name: Run api tests with coverage
    run: npm test --prefix apps/api -- --coverage
    env:
      DATABASE_URL: mysql://root:root@localhost:3306/test_db

  - name: Migration smoke (apply against fresh DB)
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: smoke_db
        ports: ["3306:3306"]
    run: |
      DATABASE_URL=mysql://root:root@localhost:3306/smoke_db \
        npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate
      DATABASE_URL=mysql://root:root@localhost:3306/smoke_db \
        npm run db:seed --workspace=apps/api
```

### Sprint 2 — start frontend tests

- Add `vitest` + `@testing-library/react` to `apps/web` dev deps
- Wire `npm test --prefix apps/web` and remove `--if-present` from the API line
- Add Sprint 1 frontend test list above (#1, #2, #3)

### Sprint 3 — coverage gate

- Set `vitest --coverage` thresholds: `lines: 50%, branches: 40%`
- Fail CI below threshold
- Increase per sprint until 70% / 60%

---

## Definition of "tested"

For this matrix, a module is considered "tested" when **all** of the below are
true:

- One or more `*.test.ts` files exercise its public functions
- Tests run in CI on every PR
- The test cases include the "happy path" + at least one error path
- Tests do not depend on `dev-user-1` mock auth (use real test fixtures)

By that definition, **5 of 26 backend modules are tested today** (~20%).
Phase 0 launch readiness requires raising this to **all P0 modules tested**
(~10 modules tested → ~40%).

---

## Sign-off

| Role | Sign-off | Date |
| --- | --- | --- |
| Lead engineer | | |
| QA lead | | |
