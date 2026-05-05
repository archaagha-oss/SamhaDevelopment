# 01 — Product Definition & Business Logic
**Samha Development CRM**

---

## What This App Does

A single web application where every unit, lead, deal, payment, contract, and broker interaction for Samha Development lives in one place — connected, tracked, and alerting the team before anything is missed.

---

## User Roles

| Role | Who | Permissions |
|---|---|---|
| ADMIN | Company owner / manager | Full access — all data, settings, user management |
| SALES | Sales staff | Leads, deals, units (read + status change), activities |
| OPERATIONS | Ops team | Deals, payments, documents, tasks |
| FINANCE | Finance staff | Payments, commissions, reports (read-only on deals) |
| READONLY | External reviewer | View only — no changes |

---

## Core Entities & How They Relate

```
Project
  └── Units (173 per tower)
        └── Unit Status History

Lead (inquiry from a person)
  ├── belongs to a Broker Agent (optional — if broker-sourced)
  │     └── belongs to a Broker Company
  ├── interested in one or more Units
  └── Activity Log (calls, WhatsApp, meetings, notes)

Deal (created when lead confirms booking)
  ├── links: Lead + Unit + Broker Agent + Payment Plan
  ├── Payment Schedule (auto-generated from plan)
  │     └── Payments (one row per milestone)
  │           └── Payment Audit Log
  ├── Documents (SPA, Oqood cert, receipts, IDs)
  └── Tasks (auto and manual)

Broker Company
  └── Broker Agents (people)
        └── Commission Records (per deal, triggered after Oqood)
```

---

## The Sales Flow (Step by Step)

### Step 1 — Inquiry
- Broker agent calls or emails about a unit
- OR a direct buyer calls
- Staff creates a **Lead** in the system immediately
- Unit is marked **INTERESTED** (not reserved — just flagged)
- Multiple leads can be interested in the same unit simultaneously

### Step 2 — Sales Offer
- Staff generates a **Sales Offer PDF** from the app (pre-filled with unit specs and price)
- PDF is sent to lead via email or WhatsApp (logged as activity)
- Lead status → OFFER_SENT

### Step 3 — Reservation (5% Booking Deposit)
- Lead agrees to proceed
- Staff reserves the unit: status → **RESERVED**
  - Only one lead can reserve a unit at a time
  - Other interested leads are notified (or manually followed up)
- 5% non-refundable booking deposit is collected
  - Payment logged: method, amount, receipt uploaded
- **Reservation Form** PDF generated and sent to lead
- Lead status → NEGOTIATING / RESERVATION_CONFIRMED

### Step 4 — Full Booking (15% + DLD + Admin)
- Lead pays:
  - 15% of sale price
  - 4% DLD fee (calculated from sale price)
  - AED 5,000 admin fee (fixed)
- Each payment logged separately with receipt
- Unit status → **BOOKED**

### Step 5 — Deal Created
- Once booking payments are confirmed, a **Deal** is created
- Deal links: Lead + Unit + Broker Agent (if applicable) + Payment Plan
- Payment schedule auto-generated (all future milestones with due dates)
- Unit status → **SOLD** (locked from further reservations)
- Auto-tasks created: "Send SPA", "Track Oqood registration"

### Step 6 — SPA (Sale and Purchase Agreement)
- SPA PDF generated from deal data (pre-filled)
- Sent for e-signature via Documenso
- SPA status tracked: PENDING → SENT → SIGNED
- Signed SPA stored in deal documents
- Deal stage → SPA_SIGNED

### Step 7 — Oqood Registration
- DLD Oqood registration initiated after SPA signed
- 90-day countdown starts from reservation date
- Alerts fire at: 30 days, 15 days, 7 days, 1 day remaining
- Oqood certificate uploaded when received
- Deal stage → OQOOD_REGISTERED
- **This is the trigger for broker commission to become payable**

### Step 8 — Construction Installments
- Payment reminders fire automatically based on payment schedule
- WhatsApp + email sent at: 7 days before, 3 days before, due date, 7 days overdue
- Each payment marked received with receipt uploaded
- PDC (post-dated cheques) tracked separately

### Step 9 — Handover
- Final 70% payment collected
- Unit handed over to buyer
- Unit status → **HANDED_OVER**
- Deal stage → COMPLETED

### Step 10 — Broker Commission
- Commission becomes payable only after:
  1. SPA is signed (confirmed in system)
  2. Oqood is registered (confirmed in system)
- System unlocks commission approval only when both conditions are met
- Admin reviews and approves commission
- Payment to broker company recorded externally, document uploaded to system
- Commission status → PAID

---

## Business Rules (Enforced by System)

### Unit Rules
- A unit can only be RESERVED by one lead at a time
- Unit status can only move forward through defined transitions:
  `AVAILABLE → INTERESTED → RESERVED → BOOKED → SOLD → HANDED_OVER`
  or sideways to `BLOCKED` at any point by ADMIN only
- A BLOCKED unit cannot be reserved or booked
- Cancellation returns unit to AVAILABLE (with reason recorded)
- Every status change is recorded in unit_status_history

### Payment Rules
- Payment amounts are locked at deal creation — cannot be changed without ADMIN override + audit entry
- A payment marked as PAID cannot be edited — only a WAIVER can be added
- PDC payments stay in PDC_PENDING until cheque clears, then → PDC_CLEARED (or PDC_BOUNCED)
- DLD fee = 4% of deal sale price (calculated and locked at deal creation)
- Admin fee = AED 5,000 fixed per deal

### Broker Commission Rules
- Broker commission cannot be approved until BOTH conditions are true:
  1. `deal.stage = OQOOD_REGISTERED` (Oqood certificate uploaded)
  2. `deal.spaSignedDate IS NOT NULL`
- Commission amount = broker company's commission rate × deal sale price
- Commission is paid to the **broker company**, not the individual agent
- Commission record must have a supporting document (Form A or equivalent) before payment is marked
- If deal is cancelled before Oqood, commission is forfeited

### Contract / Document Rules
- SPA cannot be marked SIGNED without an uploaded signed document
- Oqood cannot be marked REGISTERED without an uploaded Oqood certificate
- No document is ever hard-deleted — soft delete only (isDeleted flag)
- All documents served via signed URLs — never raw storage URLs
- Passport and Emirates ID expiry tracked — alert 60 days before expiry

### Deal Cancellation Rules
- Only ADMIN can cancel a deal
- Cancellation reason is mandatory
- If cancelled after SPA signed: separate process (outside app scope)
- If cancelled before SPA: unit returns to AVAILABLE, lead returns to LOST
- All payments to date remain in system (immutable records)
- Commission is forfeited if not yet Oqood-registered

---

## Notifications & Alerts (What Fires Automatically)

| Trigger | Alert Type | Recipient |
|---|---|---|
| Payment due in 7 days | WhatsApp + Email | Assigned sales staff |
| Payment due in 3 days | WhatsApp + Email | Assigned staff + buyer |
| Payment due today | WhatsApp + Email | Assigned staff + buyer |
| Payment 7 days overdue | WhatsApp + Email + In-app | Assigned staff + manager |
| Oqood deadline in 30 days | In-app + Email | Operations staff |
| Oqood deadline in 15 days | In-app + Email | Operations + ADMIN |
| Oqood deadline in 7 days | WhatsApp + Email | Operations + ADMIN |
| Oqood deadline in 1 day | WhatsApp + Email + Urgent in-app | ADMIN |
| Passport / RERA expiry in 60 days | Email | Operations |
| Passport / RERA expiry in 30 days | Email + In-app | Operations + ADMIN |
| SPA unsigned after 7 days | In-app | Assigned staff |
| New lead assigned | In-app | Assigned staff |
| Unit reserved | In-app | All SALES + ADMIN |
| Daily digest (8am) | Email | Each user — their tasks + overdue items |

---

## PDF Documents Generated by App

| Document | When Generated | Pre-filled From |
|---|---|---|
| Sales Offer | When lead reaches OFFER_SENT | Unit specs, price, payment plan summary |
| Reservation Form | When unit is reserved | Lead details, unit details, 5% amount |
| SPA Draft | When deal is created | Full deal data: buyer, unit, price, payment schedule |
| Payment Schedule | When deal is created | All milestones with amounts and due dates |
| Commission Statement | When commission approved | Deal, broker company, amount, date |
