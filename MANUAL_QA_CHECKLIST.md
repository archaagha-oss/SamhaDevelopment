# Manual QA Checklist — Samha CRM

**Purpose.** Click-through script covering every production flow. Run before
each release. Run again on production after deploy (smoke section only).

**How to use.** Tick each box on a fresh checkout of the doc per release. Don't
skip "expected" rows — they're the validation contract.

**Test data prerequisite.** Run `apps/api && npm run db:seed` to load fixtures
before starting (only on staging — not on production).

---

## Smoke Tests (run on production after every deploy — 10 min)

These are the **absolute minimum** to prove the app is alive.

| # | Action | Expected | ☐ |
| - | --- | --- | :-: |
| S1 | `curl -I https://api.<domain>/health` | `200 OK`, JSON body `{status:"ok",timestamp:...}` | ☐ |
| S2 | Open `https://app.<domain>` | App loads, Clerk sign-in visible, no console errors | ☐ |
| S3 | Sign in as a real prod user | Redirects to home (My Day for MEMBER, ExecutiveDashboard for ADMIN/MANAGER) | ☐ |
| S4 | Open Leads list | Shows ≥ 1 lead row OR clean empty state — never a generic spinner that doesn't resolve | ☐ |
| S5 | Open one Lead detail page | Profile, activity timeline, sidebar all render | ☐ |
| S6 | Open Deals list | Shows ≥ 1 deal OR clean empty state | ☐ |
| S7 | Open one Deal detail | Header CTA, payment plan, activity timeline render | ☐ |
| S8 | Trigger one notification (e.g. log activity) | Toast appears via Sonner; bell badge increments within 2 sec | ☐ |
| S9 | `curl https://api.<domain>/metrics \| head -20` (auth-protected) | Prometheus exposition format | ☐ |
| S10 | Sentry test event | Send a test error: `Sentry.captureException(new Error("smoke"))` from API → appears in Sentry dashboard within 30s | ☐ |

**If any smoke test fails on production, trigger rollback per `GO_LIVE_RUNBOOK.md` §3.**

---

## Authentication (run pre-release on staging — 15 min)

| # | Action | Expected | ☐ |
| - | --- | --- | :-: |
| A1 | Visit `/` while signed out | Redirected to Clerk sign-in (no `dev-user-1` bypass) | ☐ |
| A2 | Sign in with valid Clerk creds | Lands on home; user record created/synced | ☐ |
| A3 | Sign out | Redirects to sign-in; subsequent API call returns 401 | ☐ |
| A4 | Try `curl https://api.<domain>/api/leads` (no token) | `401 Unauthorized` (NOT 200 with `dev-user-1`) | ☐ |
| A5 | Sign in as VIEWER role; navigate to `/settings` | Either hidden or returns 403 | ☐ |
| A6 | Sign in as VIEWER; try `DELETE /api/leads/:id` via UI | UI hides the button; if forced via API, 403 | ☐ |
| A7 | Sign in as MEMBER; try `POST /api/contacts` | Either succeeds (if MEMBER allowed) or 403; verify against the policy in `LAUNCH_READINESS_AUDIT.md` D.1.1 | ☐ |
| A8 | Edit `localStorage.setItem("samha:role","ADMIN")` while signed in as VIEWER | UI sidebar shows admin links BUT API calls still return 403. **Only the UI is spoofed.** | ☐ |

---

## Lead lifecycle (20 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| L1 | Create a new lead — `firstName=John`, `lastName=Doe`, `phone=+9715XXXXXXXX`, `source=DIRECT`, `assignedAgentId=<your user>`. | Lead record created with `stage=NEW`, initial `LeadStageHistory` entry, auto-task "First contact within 24h". | ☐ |
| L2 | Try creating another lead with the **same phone** | Server returns `409 DUPLICATE_PHONE`; UI shows clear error toast. | ☐ |
| L3 | Open Lead detail | Profile card, KPIs, activity timeline render. Quick actions visible (Call / Email / WhatsApp / Log). | ☐ |
| L4 | Click `[Call]` quick action | `tel:` link opens (or `wa.me/` icon link works). | ☐ |
| L5 | Log a manual activity (type=CALL, summary="Test call", outcome="Interested") | New activity appears in timeline with author / timestamp. Toast confirms. | ☐ |
| L6 | Move stage NEW → CONTACTED via the stage popover | Stage updates; new `LeadStageHistory` row added. | ☐ |
| L7 | Try invalid stage transition (e.g. NEW → CLOSED_WON) | Server returns 400 with allowed-transitions list. | ☐ |
| L8 | Edit lead phone to a known-duplicate phone | Server returns 409. | ☐ |
| L9 | Delete the lead (as ADMIN) | Confirms via `ConfirmDialog`; record removed; cascade clears `LeadUnitInterest`, `LeadStageHistory`, `Activity`. | ☐ |
| L10 | Repeat L1 with `source=BROKER` but **no `brokerCompanyId`** | Server returns 400 — broker-source requires a broker. | ☐ |
| L11 | Test contacts auto-mirror: create a Lead → check `/contacts` page | New Contact row appears with `source=LEAD`, populated from the lead's phone/email. | ☐ |
| L12 | Edit the lead's email → check the mirrored Contact | Mirrored Contact's email updates within 1 second. | ☐ |

---

## Unit lifecycle (15 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| U1 | Open `/projects/<id>/units` | Units render (matrix grid or table). | ☐ |
| U2 | Open one unit | Floor plan, key info, pricing all render. Active deal block (if any) shows in sidebar. | ☐ |
| U3 | Edit unit price (inline edit) | Price updates; `UnitPriceHistory` row added. | ☐ |
| U4 | Change unit status AVAILABLE → ON_HOLD | Status updates; `UnitStatusHistory` row added; UI badge reflects change. | ☐ |
| U5 | Generate a public share token | Token created; copy link; open in incognito browser → public unit view loads (no auth needed). | ☐ |
| U6 | Revoke the share token | Same incognito link now returns 404 / "Token revoked". | ☐ |
| U7 | Delete a unit (as ADMIN, requires re-typing unit number) | Unit removed; cascade is safe (no orphan records). | ☐ |
| U8 | Bulk import: upload `units.csv` via `/units/bulk` | All rows imported with validation; failures listed inline. | ☐ |

---

## Deal lifecycle (30 min — the critical chain)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| D1 | From a Lead with primary unit-interest, click "Create Deal" | Deal created with stage `RESERVATION_PENDING`; deal links lead + unit + agent + broker. | ☐ |
| D2 | Open the deal | Header CTA reads "Reserve Unit". Stepper shows step 1. | ☐ |
| D3 | Click "Reserve Unit" | Reservation created; deal stage → `RESERVATION_CONFIRMED`. CTA changes to "Generate Sales Offer". | ☐ |
| D4 | Click "Generate Sales Offer" | PDF generated (open it — verify project name, unit, price, payment plan visible). Stored as `Document` linked to deal. Stage → next. | ☐ |
| D5 | Generate SPA Draft | PDF generated. Verify SPA includes purchaser block (firstName, EID, passport), payment table, AED text intact. Stage → `SPA_PENDING`. | ☐ |
| D6 | Mark SPA Signed | Confirms; stage → `SPA_SIGNED`. Commission status moves toward unlock. | ☐ |
| D7 | Mark Oqood Registered | Stage → `OQOOD_REGISTERED`. Commission `status` → `PENDING_APPROVAL` (assuming SPA also signed — both gates required). | ☐ |
| D8 | Record a payment (`POST /api/payments`) — partial amount | Payment row with `status=PARTIAL`. `PaymentAuditLog` entry created. Deal `paid` total increments. | ☐ |
| D9 | Record the remaining payment | `Payment.status` flips to `PAID`. Deal `paid` matches sale price. | ☐ |
| D10 | Try recording the **same payment twice** (same dealId, amount, dueDate) | App should detect and prevent (idempotency, or duplicate-detection). **NOTE: this is currently a P1 gap.** Document the result. | ☐ |
| D11 | Mark Handed Over | Stage → `HANDED_OVER`. Unit status → `SOLD` (or `HANDED_OVER`). | ☐ |
| D12 | Cancel a deal mid-stream (try at SPA_PENDING) | Deal `stage=CANCELLED`. Commission forfeited. Unit status reverts to `AVAILABLE` (or `RESERVED` if still in another deal — verify). | ☐ |
| D13 | Cancel a deal then create a new one for the **same lead + unit** | Allowed; new deal lifecycle starts cleanly. | ☐ |
| D14 | Stage move from CLOSED_WON back to NEGOTIATING (re-open) | Allowed (per `VALID_LEAD_TRANSITIONS`). | ☐ |

---

## Broker workflows (15 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| B1 | Create a BrokerCompany | Record created; appears in `/brokers/companies`. | ☐ |
| B2 | Create a BrokerAgent under that company | Record created; agent listed under the company. | ☐ |
| B3 | Edit RERA license expiry to a date 15 days from now | Compliance widget shows the company in "expiring soon" list. | ☐ |
| B4 | Try to delete a broker company that has active deals | Server returns 400 with `COMPANY_HAS_DEALS`. | ☐ |
| B5 | Create a Lead with `source=BROKER` + that company | Lead linked to broker; commission tracked in `BrokerCompany.commissions`. | ☐ |
| B6 | Auto-mirror to Contacts: check `/contacts` | New Contact row with `source=BROKER`, populated from the company. | ☐ |

---

## Communications (15 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| C1 | From Lead detail, send a WhatsApp message via `ConversationReplyBox` | Message sent via Twilio; activity logged with type=WHATSAPP, direction=OUTBOUND, status moves queued → sent → delivered. | ☐ |
| C2 | Reply to that WhatsApp from the customer's phone | Inbound webhook fires; activity logged INBOUND. ConversationThread updates. | ☐ |
| C3 | Send an email reply | Activity logged EMAIL OUTBOUND with `providerMessageSid`. | ☐ |
| C4 | Receive an inbound email to `parse.<domain>` | SendGrid parses; webhook hits `/api/webhooks/email/inbound/:token`; activity created. (Tests both signed token paths.) | ☐ |
| C5 | Toggle email opt-out for the lead | Subsequent `OUTBOUND` email is blocked; toast warns "Lead has opted out". | ☐ |
| C6 | Set preferred channel to SMS | Auto-pick uses SMS for next reminder. | ☐ |

---

## Reports & dashboards (10 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| R1 | ExecutiveDashboard `/` (as ADMIN) | All KPIs render; no console errors; no `NaN` / `undefined` fields. | ☐ |
| R2 | Pipeline by stage chart | Counts match `SELECT stage, COUNT(*) FROM Lead GROUP BY stage` directly in DB. | ☐ |
| R3 | Collections aging report | Overdue / Next 7 / Next 30 buckets render; numbers match DB. | ☐ |
| R4 | Agent summary table | Each agent row has activity count + lead count + deal count. | ☐ |
| R5 | Open `/finance` dashboard | Receivable / overdue / paid totals render. Currency uses the dirham symbol once `R3` from `UX_AUDIT_2_FINDINGS.md` lands; otherwise "AED" text. | ☐ |
| R6 | Run `/api/reports/payments?dateFrom=&dateTo=` with a tight range | Returns paginated; first page in < 1500 ms. | ☐ |

---

## Notifications (10 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| N1 | New lead assigned to you (by another user) | Bell badge increments within 2s. | ☐ |
| N2 | Click bell → click the notification | Navigates to the relevant Lead. | ☐ |
| N3 | "Mark all read" | Bell badge clears; all rows visually marked read. | ☐ |
| N4 | Payment overdue → check bell | Notification with type `PAYMENT_OVERDUE`. | ☐ |
| N5 | Test SSE: open two browser tabs as same user; trigger an event | Both tabs update without page reload. | ☐ |

---

## Settings & permissions (15 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| ST1 | As ADMIN, open `/settings` | All sections render (org, users, integrations, audit log). | ☐ |
| ST2 | Add a new MEMBER user | User created; appears in member list; receives Clerk invite email. | ☐ |
| ST3 | Deactivate a member (`?hard=false`) | Member status → `DEACTIVATED`. Their leads/deals are unchanged but they can no longer log in. | ☐ |
| ST4 | Hard-delete a member (`?hard=true`) | Member record removed (or scrubbed). PII erased per PDPL — verify no remaining traces in audit log. | ☐ |
| ST5 | Generate an API key | Key created; secret shown ONCE; subsequent visits show only the last 4 chars. | ☐ |
| ST6 | Revoke that API key | `revokedAt` set; future requests with that key return 401. | ☐ |
| ST7 | View Audit Log | Recent admin actions appear (member create/deactivate, key revoke, etc.). | ☐ |
| ST8 | As MANAGER, open `/settings/audit-log` | Either accessible (read-only) or blocked with 403 — match policy. | ☐ |

---

## Edge cases & error handling (15 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| E1 | Submit a form with the network throttled (5 sec delay) | Loading state visible; submit button disabled; no double-submit. | ☐ |
| E2 | Submit a form, then disconnect network mid-request | Toast error appears with "Network error — retry?". State is consistent (no half-saved record). | ☐ |
| E3 | Open a non-existent lead `/leads/00000` | Clean 404 page (NotFoundPage), not a console-error explosion. | ☐ |
| E4 | Upload a file > 50 MB | Multer rejects with 413; UI shows "File too large". | ☐ |
| E5 | Upload a `.exe` to broker upload | Multer rejects with 400 (allowed types only). | ☐ |
| E6 | Open `/leads?stage=GIBBERISH` | API ignores invalid filter; returns full list. (Or 400 — verify chosen behavior.) | ☐ |
| E7 | Refresh a deal detail page mid-stage-transition | Server resolves the conflict (last-write-wins or 409). | ☐ |
| E8 | Two users open the same lead and edit at once | Optimistic-lock conflict detection — second save returns 409 with diff info. | ☐ |
| E9 | Click rapidly on "Reserve Unit" 5 times | Only one reservation created (idempotency or button-disable). | ☐ |
| E10 | Browser back-button after a mutation | Page state is correct (server-truth, not stale cache). | ☐ |

---

## Mobile breakpoints (10 min)

Test on actual mobile or DevTools device emulation.

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| M1 | Sign in on iPhone-13 viewport (390×844) | Layout doesn't overflow horizontally. | ☐ |
| M2 | Open Lead detail | Header collapses cleanly; right rail stacks below main. | ☐ |
| M3 | Bottom-fixed action bar (NextStepCard mobile mode — once `UX_AUDIT_2` ships) | Tappable; doesn't cover form fields. | ☐ |
| M4 | Open Deal payment plan table | Horizontal scroll, not pinch-zoom. | ☐ |
| M5 | Submit form via on-screen keyboard | Field stays visible above keyboard. | ☐ |

---

## PDPL / data-handling spot checks (10 min)

| # | Flow | Expected | ☐ |
| - | --- | --- | :-: |
| P1 | As VIEWER role, open Lead detail | PII (EID, passport, source-of-funds) masked or hidden — per `LAUNCH_READINESS_AUDIT.md` D.1.6. **NOTE: P1 gap; document outcome.** | ☐ |
| P2 | Delete a lead → check if all `Activity` records cascade | All linked activities removed (cascade delete on `Lead.id`). No orphan rows. | ☐ |
| P3 | Erasure request: delete contact + verify no message bodies remain in any `Activity.summary` | If implementing GDPR-style erasure, confirm. **NOTE: not yet implemented.** | ☐ |
| P4 | Inbound webhook with a missing/invalid Twilio signature | Rejected with 403 (in production). | ☐ |
| P5 | Inbound webhook with valid signature but unknown number | Lands in Triage / Hot Inbox; not silently dropped. | ☐ |

---

## Sign-off

| Role | Name | Sign-off | Date |
| --- | --- | --- | --- |
| QA lead | | | |
| Lead engineer | | | |

Once all sections (or the sections relevant to the release) pass, the release is
QA-approved.
