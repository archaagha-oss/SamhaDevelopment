# 06 — Phase 3: Deals + Payments + Contracts
**Duration: 5 weeks | Depends on: Phase 2 complete | Highest Risk Phase**

---

## Goal

Zero missed payments. Zero unsigned contracts. Zero forgotten deadlines.
Every AED is tracked. Every contract has a status. Every deadline has a live countdown.

---

## The One Question This Phase Answers

> "For every active deal: what has been paid, what is due next, has the SPA been signed, and is Oqood registered on time?"

---

## Critical Rules Enforced in This Phase

1. Payment amounts are locked at deal creation — ADMIN override required to change
2. Once a payment is marked PAID, it cannot be edited
3. Commission cannot be approved until SPA signed AND Oqood registered — system enforces this, no manual override
4. Oqood deadline = reservation date + 90 days — calculated automatically, cannot be changed
5. No deal can be created without a payment plan selected
6. DLD fee = 4% of sale price — calculated and locked at deal creation
7. Admin fee = AED 5,000 fixed per deal — always present
8. All deal cancellations require ADMIN role + written reason

---

## New Screens in Phase 3

### Screen 11 — Create Deal (from lead profile)
```
Create Deal — Ahmed Al Mansouri → Unit 301

Unit: 301 — 2BR Sea View, Floor 3       [Change]
Lead: Ahmed Al Mansouri
Broker Agent: Khalid (Dubai Homes Real Estate)

Sale Price: AED [1,200,000        ]
Discount: AED [0                  ]  Reason: [         ]

Payment Plan: [30/70 Standard ▼]

─── Auto-calculated ───────────────────
DLD Fee:         AED 48,000  (4% of 1,200,000)
Admin Fee:       AED 5,000   (fixed)
Broker Commission: AED 48,000 (4% via Dubai Homes)

Reservation Date: [15/04/2026]
Oqood Deadline:   16/07/2026  (auto: +90 days)

─── Payment Schedule Preview ──────────
  1. Booking Deposit    AED 60,000   (5%)   Due: 15/04/2026
  2. DLD Fee            AED 48,000   (4%)   Due: 15/04/2026
  3. Admin Fee          AED 5,000    (fixed) Due: 15/04/2026
  4. 2nd Installment    AED 180,000  (15%)  Due: 15/05/2026
  5. Construction 10%   AED 120,000  (10%)  Due: On stage
  6. Handover Payment   AED 840,000  (70%)  Due: On handover

[Confirm & Create Deal]
```

### Screen 12 — Deal Detail
```
Deal #001 — Unit 301 — Ahmed Al Mansouri
Stage: SPA_SIGNED  ●──────────────────○

Oqood Deadline: 16/07/2026 — 92 days remaining  ⚠

─── Payments ─────────────────────────────────────────
  ✓ Booking Deposit    AED  60,000  Paid 15/04  [Receipt]
  ✓ DLD Fee            AED  48,000  Paid 15/04  [Receipt]
  ✓ Admin Fee          AED   5,000  Paid 15/04  [Receipt]
  ✓ 2nd Installment    AED 180,000  Paid 10/05  [Receipt]
  ○ Construction 10%   AED 120,000  Due: TBD (on construction stage)
  ○ Handover Payment   AED 840,000  Due: Dec 2026

─── Documents ───────────────────────────────────────
  ✓ Passport           Ahmed Al Mansouri  Expires: Jan 2028
  ✓ Emirates ID        Ahmed Al Mansouri  Expires: Mar 2027
  ✓ Sales Offer        Sent 13/04
  ✓ Reservation Form   Signed 15/04
  ✓ SPA                Signed 22/04  [View]
  ○ Oqood Certificate  PENDING

─── Commission ──────────────────────────────────────
  Dubai Homes Real Estate
  Status: NOT DUE
  Amount: AED 48,000
  Condition: Awaiting Oqood registration

[Mark Payment Received]  [Upload Document]  [Generate SPA]
```

### Screen 13 — Mark Payment Received
```
Mark Payment Received — 2nd Installment

Amount: AED 180,000
Due Date: 15/05/2026

Payment Method: [Bank Transfer ▼]
Payment Date: [10/05/2026      ]
Receipt: [Upload file           ]
Bank Name: [                   ]
Notes: [                       ]

[Confirm — This cannot be undone]
```

### Screen 14 — PDC Register (under payments)
```
Post-Dated Cheques — Deal #001

Cheque | Bank          | Amount    | Date       | Status
#1234  | Emirates NBD  | 120,000   | 01/08/2026 | PDC_PENDING
#1235  | Emirates NBD  | 840,000   | 01/12/2026 | PDC_PENDING

[Mark Cleared]  [Mark Bounced]
```

---

## Week-by-Week Tasks

### Week 9 — Deal Creation + Payment Plans

**Day 41–43: Payment Plan Builder**
- [ ] Add Prisma models: `PaymentPlan`, `PaymentPlanMilestone` (migration)
- [ ] Payment plan admin UI: create/edit plans
- [ ] Milestone rows: label, percentage, trigger type, sort order
- [ ] Special flags: isDLDFee, isAdminFee
- [ ] Seed standard Samha plans (30/70, 40/60, cash discount)
- [ ] `GET /api/payment-plans` for deal creation dropdown

**Day 44–45: Deal Creation**
- [ ] Add Prisma models: `Deal`, `Payment`, `PaymentAuditLog`, `Commission` (migration)
- [ ] `POST /api/deals` service:
  1. Validate: unit must be RESERVED or BOOKED, lead must exist
  2. Lock sale price, calculate DLD fee (4%), set admin fee (5000)
  3. Calculate broker commission (brokerCompany.commissionRate × salePrice)
  4. Calculate oqoodDeadline (reservationDate + 90 days)
  5. Generate payment schedule (one Payment row per milestone)
  6. Emit `deal.created` event
- [ ] Event handler `onDealCreated`:
  - Change unit to SOLD
  - Create auto-tasks: "Send SPA", "Collect remaining booking payments"
  - Create Commission record (status: NOT_DUE)
- [ ] Deal creation UI: form with payment schedule preview before confirmation

---

### Week 10 — Deal Stage Pipeline

**Day 46–47: Deal Stage Service**
- [ ] `PATCH /api/deals/:id/stage` — goes through deal.service.ts only
- [ ] Valid stage transitions enforced:
  ```
  RESERVATION_PENDING → RESERVATION_CONFIRMED (all booking payments received)
  RESERVATION_CONFIRMED → SPA_PENDING (auto on deal creation — or manual)
  SPA_PENDING → SPA_SENT (SPA generated + sent)
  SPA_SENT → SPA_SIGNED (signed SPA uploaded — date recorded)
  SPA_SIGNED → OQOOD_PENDING (Oqood submission initiated)
  OQOOD_PENDING → OQOOD_REGISTERED (Oqood cert uploaded — date recorded)
  OQOOD_REGISTERED → INSTALLMENTS_ACTIVE (auto)
  INSTALLMENTS_ACTIVE → HANDOVER_PENDING (final payment due)
  HANDOVER_PENDING → COMPLETED (final payment received + handover)
  ANY → CANCELLED (ADMIN only, reason required)
  ```
- [ ] Stage change auto-logs activity entry
- [ ] `onDealStageChanged` event: fire notifications, create tasks

**Day 48–50: Deal UI**
- [ ] Deal list: table with stage badges, Oqood countdown
- [ ] Deal detail page: stage pipeline progress bar
- [ ] Stage change button with stage-specific checklist
- [ ] Oqood countdown widget (days remaining, color: green/yellow/red)

---

### Week 11 — Payment Tracking

**Day 51–52: Payment Service**
- [ ] `PATCH /api/payments/:id/mark-paid`:
  1. Validate: payment must be PENDING or OVERDUE
  2. Set paidDate, paidBy, paymentMethod, receiptKey, amount
  3. Lock record (status = PAID)
  4. Write PaymentAuditLog entry
  5. Emit `payment.received` event
- [ ] `payment.received` handler: check if all booking payments done → advance deal stage
- [ ] `PATCH /api/payments/:id/mark-pdc` — add cheque details, status → PDC_PENDING
- [ ] `PATCH /api/payments/:id/pdc-cleared` — PDC_PENDING → PDC_CLEARED
- [ ] `PATCH /api/payments/:id/pdc-bounced` — PDC_PENDING → PDC_BOUNCED → creates urgent task

**Day 53–55: Payment UI**
- [ ] Payment list per deal with status badges
- [ ] Mark Received modal: method, date, receipt upload, notes
- [ ] PDC register tab within deal payments
- [ ] Admin override: ADMIN can edit locked payment with mandatory reason + audit log entry
- [ ] Receipt download (signed URL from R2)
- [ ] Overdue payments highlighted in red with days overdue count

---

### Week 12 — Automated Reminders + Oqood Tracking

**Day 56–57: Background Jobs**
- [ ] `overdueDetection.job.ts` — daily 7am: marks PENDING payments past due date as OVERDUE, fires `payment.overdue` event
- [ ] `paymentReminder.job.ts` — daily 7am: finds payments due in 1, 3, 7 days → WhatsApp + email
- [ ] `oqoodDeadline.job.ts` — daily 7am: alerts at 30, 15, 7, 1 day remaining
- [ ] `payment.overdue` handler: WhatsApp to buyer + email + urgent task to staff

**Day 58–60: Oqood & SPA Tracking**
- [ ] SPA status section on deal: PENDING / SENT / SIGNED
- [ ] "Generate SPA PDF" button — pre-filled from deal data
- [ ] SPA sent → send for e-signature via Documenso API
- [ ] Documenso webhook: signed → upload to documents, update deal.spaSignedDate, advance stage
- [ ] Oqood cert upload → set oqoodRegisteredDate, advance stage → triggers commission unlock

---

### Week 13 — Documents + Commission Unlock

**Day 61–62: Document Management**
- [ ] Add Prisma model: `Document` (migration)
- [ ] `POST /api/documents/upload` — get pre-signed R2 upload URL
- [ ] `POST /api/documents` — save record after upload
- [ ] `GET /api/documents/:id/download` — generate signed download URL (15-min expiry)
- [ ] `DELETE /api/documents/:id` — soft delete only

**Day 63–64: Deal Document Checklist**
- [ ] Per-deal document checklist UI:
  ```
  Required Documents:
  ✓ Passport
  ✓ Emirates ID
  ○ Visa (if non-citizen)
  ✓ Reservation Form (signed)
  ✓ SPA (signed)
  ○ Oqood Certificate   ← MISSING — deal cannot advance without this
  ✓ Payment Receipts (4/6 uploaded)
  ```
- [ ] Missing documents shown prominently — cannot advance stage if mandatory doc missing
- [ ] Document expiry tracking (passport, RERA)

**Day 65: Commission Unlock Logic**
- [ ] `commission.service.ts` — `tryUnlockCommission(dealId)`:
  1. Check `deal.spaSignedDate IS NOT NULL`
  2. Check `deal.oqoodRegisteredDate IS NOT NULL`
  3. If both true: commission.status → PENDING_APPROVAL
  4. Emit `commission.unlocked` event
  5. Notify FINANCE role + create approval task
- [ ] Called from: `onDealStageChanged` when stage = OQOOD_REGISTERED
- [ ] Commission section on deal detail: shows status, amount, unlock conditions

---

## API Endpoints for Phase 3

```
# Payment Plans (Admin)
GET    /api/payment-plans
POST   /api/payment-plans
GET    /api/payment-plans/:id
PATCH  /api/payment-plans/:id
POST   /api/payment-plans/:id/milestones

# Deals
POST   /api/deals                              # create + generate payment schedule
GET    /api/deals
GET    /api/deals/:id                          # full deal with payments + docs
PATCH  /api/deals/:id/stage                    # stage change (service layer)
POST   /api/deals/:id/cancel                   # ADMIN only, reason required

# Payments
GET    /api/deals/:id/payments                 # payment schedule
PATCH  /api/payments/:id/mark-paid             # lock on confirm
PATCH  /api/payments/:id/mark-pdc
PATCH  /api/payments/:id/pdc-cleared
PATCH  /api/payments/:id/pdc-bounced
POST   /api/payments/:id/admin-override        # ADMIN + reason + audit log
GET    /api/payments/overdue                   # all overdue across project

# Documents
POST   /api/documents/presigned-url            # R2 upload URL
POST   /api/documents                          # save record
GET    /api/documents/:id/download             # signed download URL
DELETE /api/documents/:id                      # soft delete
GET    /api/deals/:id/document-checklist        # what's missing

# Commissions
GET    /api/commissions/pending-approval        # FINANCE dashboard
PATCH  /api/commissions/:id/approve            # ADMIN or FINANCE
PATCH  /api/commissions/:id/mark-paid          # with document upload
```

---

## Phase 3 Definition of Done

- [ ] Deal creation generates payment schedule automatically
- [ ] DLD fee and admin fee auto-calculated and locked
- [ ] Deal stages advance through correct transitions only
- [ ] Payment mark-received locks record and writes audit log
- [ ] PDC register tracks cheques with statuses
- [ ] Overdue payments detected daily and alerts sent
- [ ] Payment reminders fire at 7/3/1 days before due
- [ ] SPA PDF generated pre-filled from deal data
- [ ] Documenso e-sign flow works end to end
- [ ] Oqood 90-day countdown visible + alerts fire
- [ ] Document checklist shows missing items per deal
- [ ] Commission status = NOT_DUE until SPA signed + Oqood registered
- [ ] Commission unlocks to PENDING_APPROVAL automatically when both conditions met
- [ ] FINANCE notified when commission ready for approval
- [ ] All documents served via signed URLs only

**When all boxes are checked, Phase 4 begins.**
