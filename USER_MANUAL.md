# Samha CRM — User Manual

**Audience.** Sales agents and brokers using the CRM day-to-day.
**Scope.** End-user workflows only — admin tasks live in `ADMIN_MANUAL.md`.

---

## 1. Getting started

### 1.1 Sign in

1. Open `https://app.<your-domain>` in Chrome, Edge, or Safari.
2. Click **Sign in**. Use your invited email; first-time users set a password
   via Clerk's email link.
3. After sign-in you land on **My Day** (members) or **Executive Dashboard**
   (managers/admins).

If sign-in fails, contact your admin — your invite may have expired.

### 1.2 The home screen

| Role | Home screen | Purpose |
| --- | --- | --- |
| MEMBER (sales agent) | **My Day** | Personal queue: tasks due, follow-ups overdue, leads going silent, payments due, hot inbox |
| MANAGER / ADMIN | **Executive Dashboard** | Org-wide pipeline, finance, agent leaderboard |

You can switch between them via the sidebar.

### 1.3 The sidebar

- **My Day** / **Dashboard** — home
- **Leads** — all your leads
- **Deals** — your active deals
- **Units** — inventory across projects
- **Projects** — projects you have access to
- **Brokers** — broker companies and agents
- **Contacts** — master contact directory (auto-populated from leads + brokers)
- **Reports** — analytics
- **Settings** — your profile and preferences

---

## 2. Working a lead

### 2.1 Create a lead

1. Click **Leads** in the sidebar → **+ Add lead** (top right).
2. Required: First name, last name, phone (UAE format `+9715XXXXXXXX`), source.
3. Optional but recommended: email, nationality, budget, broker (if
   `source = BROKER`), notes.
4. Click **Create**.

The system:
- Creates the lead in stage `NEW`.
- Adds a task **"First contact within 24h"** with tomorrow's due date.
- Mirrors the lead into Contacts so it's discoverable from any future project.

If the phone is already on another lead, you'll see **"Lead with this phone
already exists"** with a link to the existing record.

### 2.2 Lead stages

The pipeline flows through these stages:

```
NEW → CONTACTED → QUALIFIED → VIEWING → PROPOSAL → NEGOTIATING → CLOSED_WON / CLOSED_LOST
```

Common transitions:

- **NEW → CONTACTED** after first phone/WhatsApp/email touch.
- **CONTACTED → QUALIFIED** once you've confirmed budget and intent.
- **VIEWING → PROPOSAL** after a site visit and a sales offer is sent.
- **NEGOTIATING → CLOSED_WON** when payment is received and a deal record exists.

You can re-open a closed lead by moving CLOSED_LOST → NEW or
CLOSED_WON → NEGOTIATING.

### 2.3 Log an activity

From the Lead detail page:

- **Call** — opens `tel:` link in your device. After the call, click
  **Log activity** → type **CALL**, summary, outcome.
- **WhatsApp** — opens wa.me link OR sends via the integrated WhatsApp panel.
- **Email** — opens the in-app reply box pre-filled.
- **Meeting / Site visit / Note** — manual via **Log activity**.

Activities appear in the Activity timeline in chronological order. You can
filter the timeline by type (calls only, emails only, system events).

### 2.4 Tasks & follow-ups

Each lead has a **Tasks** panel showing the next 3 tasks due within 14 days.
Inline actions:

- **Complete** — marks the task done and stamps the completion time.
- **Snooze 1d / 3d / 1w** — bumps the due date.
- **Reassign** — moves the task to another agent.

To add a task: type into the input at the bottom of the panel, e.g.
**"Call back tomorrow 3pm"**. The natural-date parser handles most phrases.

### 2.5 Communication preferences

Each lead has a per-channel preference (Email / WhatsApp / SMS) plus opt-out
toggles. The system uses the preferred channel when sending automated
reminders; it never sends on a channel the lead has opted out of.

### 2.6 Convert lead to deal

When a lead is ready to buy:

1. Make sure the lead has at least one **Interested unit** (set via the
   "Interested units" sidebar).
2. Click **Create Deal** in the lead's header.
3. Pick the unit (defaults to the primary interest), payment plan, sale price.
4. Click **Create**.

The deal record links the lead, unit, agent, and broker. The lead's stage
moves to **NEGOTIATING**.

---

## 3. Working a deal

### 3.1 Deal stages

```
RESERVATION_PENDING → RESERVATION_CONFIRMED → SPA_PENDING → SPA_SIGNED →
OQOOD_PENDING → OQOOD_REGISTERED → PAYMENT_IN_PROGRESS → HANDED_OVER
                                              ↘ CANCELLED at any point
```

Each stage exposes a **single primary action** in the right rail of the deal
detail page:

| Stage | Primary action |
| --- | --- |
| RESERVATION_PENDING | Reserve unit (record reservation fee) |
| RESERVATION_CONFIRMED | Generate Sales Offer (PDF) |
| SPA_PENDING | Generate SPA Draft (PDF) |
| SPA_SIGNED | Mark Oqood Registered |
| OQOOD_REGISTERED | Record next payment |
| PAYMENT_IN_PROGRESS | Record next payment / Mark Handed Over (when fully paid) |

### 3.2 Document generation

All PDFs are stored as `Document` records linked to the deal:

- **Sales Offer** — first commercial document; includes price, payment plan,
  unit details. Sent to the lead for review.
- **SPA Draft** — Sale & Purchase Agreement; includes purchaser block (EID,
  passport), payment table, project details.
- **Reservation Form** — short legal form signed at reservation time.
- **Receipt** — generated on every payment record.

Each document has versioning. If you regenerate the SPA after edits, V2
supersedes V1; both remain accessible from the **Documents** sidebar block.

### 3.3 Recording a payment

1. From the Payments table on the deal detail page, click **Record payment**.
2. Enter amount, date, reference (cheque #, bank transfer ref).
3. Click **Save**.

If the amount is less than the milestone amount, the payment is marked
`PARTIAL`. Multiple partial payments roll up to the milestone total. Once full,
the milestone flips to `PAID` and the next milestone becomes active.

Every payment write creates an entry in the **Payment audit log** — visible
to admins under Settings.

### 3.4 Commissions

Commission is **unlocked** when both conditions are met:

1. SPA marked signed, AND
2. Oqood marked registered.

Until then, commission status is `NOT_DUE`. After unlock it moves
`PENDING_APPROVAL` → admin reviews → `APPROVED` → finance pays out → `PAID`.

If a deal is cancelled at any stage, the commission is forfeited.

### 3.5 Cancelling a deal

1. From the deal header, click **More** → **Cancel deal**.
2. Provide a reason (required for analytics).
3. Confirm.

Effects:
- Deal stage → `CANCELLED`.
- Unit returns to `AVAILABLE` (unless another active deal exists).
- Commission forfeited.
- Lead stage stays where it was — re-open it via stage popover if the buyer
  re-engages.

---

## 4. Working a unit

### 4.1 Unit detail

Every unit shows:
- Hero floor plan + photos
- Key info (type, floor, view, area, price/sqft)
- Pricing card (current price + base price for comparison)
- Payment plan (collapsible)
- Property specs
- Activity feed (inquiries, site visits, price adjustments, listing events)
- Tags + internal notes
- History

### 4.2 Sharing a unit publicly

1. From the unit detail, click **Share** in the right rail.
2. The system generates a public link with a one-time token.
3. Send the link via WhatsApp / email — recipient sees a clean public view
   with no login required.

To revoke a link, click **Revoke** next to it. Anyone with the link gets a
"link revoked" page after revocation.

### 4.3 Unit statuses

| Status | Meaning | Common next |
| --- | --- | --- |
| AVAILABLE | Open for sale | ON_HOLD or RESERVED |
| ON_HOLD | Soft hold for a lead (auto-expires) | RESERVED or AVAILABLE |
| RESERVED | Reservation fee paid, deal created | SOLD or AVAILABLE (cancellation) |
| SOLD | Full payment received | HANDED_OVER |
| HANDED_OVER | Buyer received keys | (terminal) |
| BLOCKED | Manual hold by manager (e.g. for showroom) | AVAILABLE |

ON_HOLD has a configurable expiry (default 48h). After expiry, the system
auto-releases the unit unless converted to RESERVED.

---

## 5. Brokers

### 5.1 Working with broker leads

When you create a lead with `source = BROKER`, you must pick a **Broker
company** and optionally a **Broker agent**. The broker is then attached to
all subsequent deals from that lead.

### 5.2 Commission rates

Each broker company has a default commission rate (4% standard). Individual
deals can override this — admin only. The rate snapshot is locked in at deal
creation time, so later changes to the broker's rate don't retroactively
affect earlier deals.

### 5.3 RERA compliance

The system tracks RERA license expiry for every broker company and agent. The
**Brokers → Compliance** page lists licenses expiring within 30 days. Renew
the licence and update the expiry date in the broker's record.

---

## 6. Contacts

The Contacts module is your **master directory**. Every lead and broker auto-
mirrors into it, so you can quickly find anyone you've ever interacted with.

- **Source filter:** narrow to MANUAL / LEAD / BROKER / REFERRAL / IMPORT.
- **Search:** name, email, phone, company.
- **Tags:** comma-separated; useful for grouping (`vip`, `investor`, etc.).

A contact created from a lead is read-mostly — edits flow through to the
underlying lead. The Contact's `__src:lead:<id>` tag identifies it.

---

## 7. Reports

### 7.1 Pipeline

Lead pipeline by stage with counts and value totals. Click a stage to drill
into those leads.

### 7.2 Finance

- **Receivable** — total outstanding across all active deals
- **Overdue** — payments past due date
- **Collected this month** — paid amount within the current calendar month
- **Aging** — receivables bucketed 0–30 / 31–60 / 61–90 / 90+

### 7.3 Agent summary

For each agent: lead count, deal count, activities last 30 days, conversion
rate. Sorted by conversion by default.

---

## 8. Notifications

### 8.1 The bell

Top right of the app. Badge shows unread count. Click to open the panel —
last 20 notifications, with click-through to the source entity.

### 8.2 Notification types

| Type | Triggered by |
| --- | --- |
| `NEW_LEAD_ASSIGNED` | An admin reassigns a lead to you |
| `DEAL_STAGE_CHANGED` | A deal you're following moves stage |
| `PAYMENT_OVERDUE` | A payment due date passes |
| `RESERVATION_EXPIRING` | A reservation is within 24h of expiry |
| `OQOOD_DEADLINE` | Oqood deadline approaching |
| `COMMISSION_PENDING` | Commission moves to `PENDING_APPROVAL` |
| `GENERAL` | Org-wide announcement |

### 8.3 Mark all read

Click **Mark all read** in the panel header. Cleared notifications stay in
your history for 30 days, then are pruned.

---

## 9. Search

### 9.1 Global search

`Cmd/Ctrl + K` opens global search. Type to query across leads, deals, units,
contacts, projects, broker companies. Results group by entity type.

### 9.2 Filter URLs

Most list pages encode their filters in the URL — copy the URL to share or
bookmark a filtered view. Example: `/leads?stage=QUALIFIED&assignedAgentId=me`.

---

## 10. Settings (your own)

Under your avatar (top right) → **Settings**:

- **Profile** — name, photo, contact details
- **Notifications** — per-type opt-in/out
- **Communication signature** — appended to outbound emails
- **Theme** — Light / Dark / System

Org-wide settings (users, integrations, audit log) are admin-only — see
`ADMIN_MANUAL.md`.

---

## 11. Mobile

The app works on mobile (≥ 375px wide). Touch-optimized interactions:

- Quick-action buttons reduce to icons (Call / WhatsApp / Email / Log).
- Right rail collapses below the main column.
- The "Next step" CTA on detail pages becomes a fixed bottom bar.

For day-long use, desktop is recommended — bulk operations and saved views
are desktop-only today.

---

## 12. Tips for daily use

- **Start the day on My Day.** The action queue is the canonical to-do list;
  everything else is reference.
- **Log every touch.** Even a 30-second call. The activity timeline is your
  memory and your manager's measurement.
- **Use filters in the URL.** Save your favorite filter combinations as
  bookmarks until saved-views ship.
- **Trust the staleness colors.** A red border on a lead card means it's
  been silent for 15+ days. Surface it before your manager does.
- **Never skip stages.** If the system blocks a stage transition, it's
  enforcing the SPA / Oqood gate. Talk to your admin if you think the rule
  is wrong.

---

## 13. Getting help

- In-app: **Help** in the sidebar (link to this manual).
- Reset password: Clerk sign-in screen → "Forgot password".
- Anything else: ask your admin or post in `#samha-support`.

For known limitations at launch, see **GO_LIVE_RUNBOOK.md §6**.
