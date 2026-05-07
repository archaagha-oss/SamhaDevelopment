# Architecture Assessment — Units Module & Surrounding Domain

> **Scope**: Senior-architect review of the `Unit` model and adjacent modules in `SamhaDevelopment`, framed against what a Dubai off-plan **single-tower-per-project developer** would need.
> **Branch**: `claude/assess-realestate-architecture-z9p7G`
> **Constraints**: No external/government API integrations in this round (no DLD, RERA Trakheesi, UAE Pass, payment gateway, AML/PEP, e-sign vendor, WhatsApp/SMS provider, accounting GL adapter).

---

## 1. Executive Summary

| Area | Verdict |
|---|---|
| Deal / Payment / Commission engine | **Best-in-class** — keep, build around. |
| Unit lifecycle state machine (8 states) | **Strong** — strict transition table, immutable history. |
| Master-data hierarchy | **Flat** — `Project → Unit`. Add `Phase` for staged release. |
| Customer KYC / joint owners | **Missing** — major gap for SPA accuracy. |
| SPA / handover / snagging / title-deed | **Missing** — biggest functional gap. |
| Financial primitives (invoice, VAT, late-fee enforcement, refund, escrow, multi-currency) | **Latent or absent** — close before scaling. |
| External integrations | **Stubbed** — out of scope this round. |
| Reporting / dashboards | **Strong** — extend, don't rebuild. |
| CI / RBAC granularity | **Light** — easy fixes. |

**Bottom line**: the engine is good. The gaps are around it (master data, KYC, post-sale workflows, financial primitives). Everything closes additively — no rewrites.

---

## 2. Stack Snapshot

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 4 + TypeScript 5 |
| ORM | Prisma 5 → MySQL |
| Auth | Clerk (optional in dev) |
| Frontend | React 18 + Vite + Tailwind + TanStack Query |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| Jobs | In-process polling + `BackgroundJob` + `DomainEvent` tables |
| Tests | Vitest |
| Deploy | PM2 cluster + Docker Compose (Postgres image — schema actually uses MySQL) |

---

## 3. Existing Strengths (worth preserving verbatim)

### 3.1 Unit lifecycle
8-state machine (`apps/api/prisma/schema.prisma:24`, `apps/api/src/services/unitService.ts:10-22`):

```
NOT_RELEASED → AVAILABLE → ON_HOLD → RESERVED → BOOKED → SOLD → HANDED_OVER
                       ↘                                         ↗
                         BLOCKED ───────────────────────────────
```

- `ON_HOLD`/`RESERVED`/`BOOKED`/`SOLD`/`HANDED_OVER` are *deal-owned* — manual API attempts to set them are rejected.
- `holdExpiresAt` enables a soft offer-period hold with auto-release via background job (`unitService.ts:257-273`).
- Every change writes immutably to `UnitStatusHistory`.

### 3.2 Two-gate commission unlock
`Commission.spaSignedMet` AND `Commission.oqoodMet` must both be true before status moves `NOT_DUE → PENDING_APPROVAL`. This is *exactly* how broker payouts are gated in well-run Dubai shops. **Keep.**

### 3.3 Payment plan flexibility
`MilestoneTrigger` enum supports `DAYS_FROM_RESERVATION`, `FIXED_DATE`, `ON_SPA_SIGNING`, `ON_OQOOD`, `ON_HANDOVER`. Five triggers covers most off-plan plans. **Add `ON_CONSTRUCTION_PCT`** to make it complete.

### 3.4 Audit
`UnitStatusHistory`, `UnitPriceHistory`, `LeadStageHistory`, `DealStageHistory`, `PaymentAuditLog` are all immutable append-only. Good defensive design.

### 3.5 PDC tracking
`Payment.pdcNumber/pdcBank/pdcDate/pdcClearedDate/pdcBouncedDate` plus `PDC_PENDING/PDC_CLEARED/PDC_BOUNCED` statuses model the cheque workflow Dubai sales actually use.

### 3.6 Reporting surface
Frontend already ships an executive dashboard, payment report, commission dashboard, task dashboard, and an 8-tab `ReportsPage`. The data model is reportable; we just feed it richer inputs.

---

## 4. From-Scratch Reference: A Dubai Single-Tower Developer System

### 4.1 Data hierarchy
```
Organization
  └─ Project (= one tower)
       ├─ ProjectConfig (DLD %, admin fee, VAT %, Oqood days, reservation days, tax registration #)
       ├─ Phase (staged release: lower-floors / upper-floors / penthouses)
       │    └─ PhaseRelease (INTERNAL → BROKER_PREVIEW → PUBLIC)
       ├─ UnitTypePlan (master template — 1BR-A, 2BR-Premium, …)
       └─ Unit (instance of UnitTypePlan, lives in a Phase)
            ├─ ConstructionMilestone (per-phase % complete)
            ├─ HandoverChecklist (when entering HANDOVER_PENDING)
            ├─ SnagList (pre- and post-handover)
            ├─ DefectLiabilityPeriod (clock from handover)
            └─ TitleDeedTransfer
```

### 4.2 Customer side
```
Lead → Deal
        ├─ DealParty[] (joint-owners, ownership % sums to 100)
        │    └─ KYCRecord (per party: ID number/expiry, nationality, residency, source-of-funds, occupation)
        ├─ PaymentPlan
        │    └─ Payment[] (with VAT, currency, FX snapshot)
        ├─ Invoice[] (sequential per fiscal year, VAT lines)
        │    └─ Receipt[]
        ├─ RefundRequest[] (approval workflow)
        └─ Commission (TieredCommissionRule + CommissionSplit)

Project
  └─ EscrowAccount
       └─ EscrowLedgerEntry[] (credit on payment received, debit on developer drawdown)
```

### 4.3 Pricing
Stacked components with audit at each layer:
```
Unit.basePrice
  + floorPremium     (e.g. AED 5k/floor above 10)
  + viewPremium      (sea > garden > street)
  + cornerPremium
  + orientationPremium
  ± PricingRule adjustments (project / unit type / phase / view scopes)
  ± deal-level discount
= Deal.salePrice
```
Today these premiums sit in `Unit.tags` JSON or notes — opaque to the rule engine. Promote them to first-class fields.

---

## 5. Gap Matrix (What changes in this implementation)

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| G1 | No `Phase` / staged release | M | New `Phase` + `PhaseRelease` models; `Unit.phaseId` FK. |
| G2 | No `UnitTypePlan` template | M | New model; `Unit.unitTypePlanId` FK. |
| G3 | Missing Unit fields (tenure, Makani, plot, premiums, areas) | M | Extend `Unit` (all nullable). |
| G4 | No structured KYC | H | New `KYCRecord` + scheduled expiry monitor. |
| G5 | No joint owners | H | New `DealParty` (sum-to-100 invariant). |
| G6 | No SPA PDF generator | H | Handlebars + Puppeteer template engine; `Document(type=SPA, source=GENERATED)`. |
| G7 | No `Invoice` / `Receipt` entities | H | New models; sequential numbering via `OrgNumberSequence`; PDF rendered. |
| G8 | VAT not applied | M | `vatService` applies `ProjectConfig.vatPercent` to invoice lines. |
| G9 | Late-fee rules dormant | M | `lateFeeService` scheduled job applies fees, writes `PaymentAuditLog`. |
| G10 | No refund workflow | M | New `RefundRequest` state machine. |
| G11 | No escrow ledger | H | New `EscrowAccount` + `EscrowLedgerEntry` (RERA record-keeping). |
| G12 | AED hardcoded | M | `currency` + `fxRate` + `fxSnapshotAt` on `Payment`/`Invoice`. |
| G13 | Flat commissions only | M | `TieredCommissionRule` + `CommissionSplit`. |
| G14 | No construction-progress trigger | M | New `MilestoneTrigger.ON_CONSTRUCTION_PCT`; `ConstructionMilestone` entity. |
| G15 | No snagging / DLP | H | `SnagList` + `SnagItem` + `DefectLiabilityPeriod`. |
| G16 | No handover checklist | H | `HandoverChecklist` + items; gates final stage transition. |
| G17 | No title-deed transfer entity | M | `TitleDeedTransfer` (manual entry). |
| G18 | RERA expiry monitor exists, doesn't alert | L | Finish job; emit notifications. |
| G19 | RBAC role-only | L | Add record-level scoping for Refund/Escrow. |
| G20 | No CI | L | `.github/workflows/ci.yml` (typecheck + test + prisma validate). |
| G21 | Lifecycle (lease/service-charge/facility) | (later) | Schema only this round. |

---

## 6. Implementation Phasing

| Phase | Output | Branch state after |
|---|---|---|
| 0 | This document | reviewable, no code |
| 1 | Schema additions + migration + seed extensions | DB has new tables; existing data untouched |
| 2 | Sales-workflow services (KYC, party, SPA PDF, handover, snag, title deed, construction) + routes | New endpoints functional |
| 3 | Financial services (invoice, receipt, refund, late-fee, escrow, VAT, FX, tiered commission) | Money primitives complete |
| 4 | Frontend pages | UI exposes new capabilities |
| 5 | Reports, RBAC scoping, GitHub Actions CI | Productionised |

Each phase = one or two reviewable commits.

---

## 7. Verification Strategy

### Per phase
- **Phase 1**: `prisma validate` clean, `prisma migrate dev --name phase_1_domain_expansion` clean, existing seed runs, existing integration test (`deal-lifecycle.integration.test.ts`) green.
- **Phase 2**: new Vitest suites for KYC, joint-party (sum-to-100), SPA PDF gen, handover gate, snag workflow, construction trigger.
- **Phase 3**: invoice number gap-free across fiscal-year boundary; late-fee dry-run; escrow credit−debit reconciliation; refund happy + denied; tiered commission band resolution.
- **Phase 4**: `pnpm --filter web dev` smoke each new route; existing screens still render.
- **Phase 5**: CI green on push.

### End-to-end
Lead → KYC entered → joint owner added (60/40) → reservation → SPA PDF generated → manual signature uploaded → Oqood data entered → construction milestone hit → payment fires → invoice + receipt issued → handover checklist completed → title deed entered → unit `HANDED_OVER`.

---

## 8. Explicitly Out of Scope (descope from senior-arch ideal)

- Multi-tower hierarchy (Tower / Building intermediate models).
- DLD / RERA Trakheesi / UAE Pass live API.
- Payment gateway (Telr / NI / Checkout / PayTabs).
- WhatsApp / SMS provider.
- E-sign vendor (DocuSign / Emirates eSign / Documenso).
- AML / PEP / sanctions screening provider.
- Accounting / GL adapter (ERPNext / SAP / Tally / QuickBooks).
- Live RERA license verification.
- Lifecycle services & UI (lease, service charge, facility, resale) — schema seeded only.

The schema and service seams added in Phases 1–3 accommodate every one of these without breaking changes when they land.

---

## 9. Reused Building Blocks (no reinvention)

| Existing | Reused for |
|---|---|
| `apps/api/src/lib/prisma.ts` | All new models. |
| `apps/api/src/events/eventBus.ts` | New domain events (KYC expiring, snag raised, handover completed, invoice issued, late-fee applied, escrow credited/debited, title-deed transferred, construction-pct updated). |
| `apps/api/src/events/jobs/jobHandlers.ts` | Late-fee runner, KYC expiry monitor, RERA expiry alert. |
| `apps/api/src/services/documentService.ts` | SPA PDF, snag photos, invoices, receipts. |
| `apps/api/src/services/unitService.ts:32-46` `validateStatusTransition` | Reused pattern for refund / snag / handover state machines. |
| `apps/api/src/services/dealService.ts` `VALID_DEAL_TRANSITIONS` | Same shape gates handover-checklist completion. |
| `apps/web/src/components/UnitGrid.tsx` colour legend | Extended for Phase grouping + release-stage. |
| `apps/web/src/components/OqoodCountdown.tsx` | Pattern for KYC expiry / RERA expiry / DLP countdown. |

---

## 10. Pragmatic Notes

- Engine stays. We add around it.
- Phases stop cleanly — pause after any phase, system remains shippable.
- All schema changes are additive with nullable / defaulted fields. No data migration risk.
- Lifecycle (lease, service charge, facility, resale) ships schema-only this round so future work doesn't need a breaking migration.
