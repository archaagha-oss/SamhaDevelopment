# Wireframe vs Implementation Gap Analysis

## Overview
Comparing provided text wireframes against current codebase implementation. Identifies what exists, what's partial, and what needs to be built.

---

## 1. Unit Matrix Screen (Projects & Units)

### Wireframe Requirements
- Grid layout (6 columns, multiple floors/rows)
- Color-coded status badges: GRN (green/available), ORG (orange/reserved), RED (red/sold), GRY (grey/blocked)
- Unit cards: number + status + type
- Floor grouping/navigation
- Filters: Floor, Type, Price Range (sticky to URL)
- Cell click → slide-over detail panel
- Panel shows: unit details + history + action buttons (Create Offer / View Deal / Release Hold / Edit)

### Current Implementation
- ❌ UnitsPage exists but as **table layout**, not grid
- ❌ No floor grouping
- ❌ No color-coded status system (we added colors.ts but not applied)
- ❌ No slide-over panel on click
- ✅ Filters exist (project, status, price) but NOT sticky to URL
- ✅ Backend API: `/api/units` with filters supported

### Gap Summary
**Effort**: 2-3 days  
**Priority**: HIGH (core UX for sales team daily workflow)

### Implementation Tasks
1. Refactor UnitsPage from table to CSS Grid (6 cols desktop, 3 tablet, 1 mobile)
2. Group units by floor with collapsible sections
3. Apply color constants (STATUS_COLORS.AVAILABLE → green, .ON_HOLD → orange, etc.)
4. Build slide-over panel component (right side)
5. Integrate useFilterState hook for URL params
6. Add "Create Offer" action from grid cell

### Design Notes
- Floor grouping should collapse/expand
- Grid cells should show tooltip on hover (unit #, type, area, price)
- Slide-over should animate in from right (Tailwind: `translate-x-full`)
- Buttons in panel should be contextual (if AVAILABLE → "Create Offer", if RESERVED → "View Deal", if ADMIN → "Release Hold")

---

## 2. Leads List Screen

### Wireframe Requirements
- Lead cards (grid or list) with:
  - Name + Phone + Email (left side)
  - Status badge (SOURCE, STATUS, AGENT, BROKER - right side)
  - Quick actions: "View" + "+ Offer" buttons
- Filter tabs: All / New / Contacted / Interested / Reserved / Dead
- "Add Lead" button opens slide-over form
- Responsive: cards stack on mobile

### Current Implementation
- ✅ LeadsPage exists
- ✅ Lead filtering by status exists
- ⚠️ UI layout may not match card design
- ✅ Backend: `/api/leads` with status filter
- ❌ Slide-over "Add Lead" modal likely missing
- ❌ "+ Offer" quick action not visible in list

### Gap Summary
**Effort**: 1 day (mostly UI refinement)  
**Priority**: MEDIUM

### Implementation Tasks
1. Refactor lead list to card layout (2-3 cols on desktop, 1 on mobile)
2. Add SOURCE, STATUS, AGENT, BROKER badges (right side of card)
3. Add "View" + "+ Offer" buttons to each card
4. Create "Add Lead" slide-over modal with form
5. Ensure status tabs match wireframe (All / New / Contacted / Interested / Reserved / Dead)

---

## 3. Lead Detail & Offer Flow

### Wireframe Requirements
- Lead detail page showing:
  - Name + Phone + Email + Nationality + Source + Assigned Agent + Broker
  - Tabs: Offers / Deals / Activity
  - Offers list (2 items shown) with validity, expiry, status
  - "+ New Offer" button
- Create Offer modal with:
  - Lead selector (auto-filled if from lead detail)
  - Unit selector (pre-filled if from unit matrix)
  - Offered price input
  - Validity (days) input
  - Unit preview (number, type, sqft, AED/sqft, total)
  - Cancel / Create Offer buttons
- Toast after acceptance: "Offer accepted. Create deal?" with "Create Deal" button

### Current Implementation
- ✅ LeadProfilePage exists
- ⚠️ Likely has tabs but may not match exact structure
- ⚠️ Offers tab exists but formatting may differ
- ❌ Create Offer modal may be incomplete or missing
- ❌ Toast "Create Deal" flow likely missing

### Gap Summary
**Effort**: 1-2 days (modal + toast flow)  
**Priority**: HIGH (critical conversion path)

### Implementation Tasks
1. Review LeadProfilePage tabs (ensure Offers / Deals / Activity)
2. Enhance Offers tab display (add validity countdown, status badge)
3. Build "Create Offer" modal with:
   - Lead pre-selector (autocomplete)
   - Unit pre-selector (autocomplete, shows unit details)
   - Price validation
   - Validity calculation (today + N days)
4. Add POST /api/offers integration
5. On offer acceptance, show toast with "Create Deal" CTA
6. "Create Deal" button calls deal creation API and navigates to Deal Cockpit

---

## 4. Deals Kanban Board

### Wireframe Requirements
- Horizontal columns for each stage (11 total)
- Column header: Stage name + (count)
- Deal cards showing:
  - Deal #number
  - Lead name (first name only)
  - Unit number
  - Days until due (or "overdue" badge 🔺)
  - Agent avatar / initials
- Drag-and-drop card between columns
- On invalid drag, snap back + toast error
- Double-click card → open Deal Cockpit
- "Show: All / Active only" filter
- Search deals
- Column collapse toggle (already implemented!)

### Current Implementation
- ✅ DealsKanban exists with:
  - ✅ Horizontal columns
  - ✅ Deal cards with drag-drop
  - ✅ Payment progress bars (shows %)
  - ✅ Commission status
  - ✅ Column collapse toggle (A2 completed)
- ⚠️ Cards may not show agent initials
- ⚠️ Overdue indicator may not match wireframe style (🔺)
- ✅ Invalid drag handling (toast error exists)

### Gap Summary
**Effort**: 0.5 days (minor refinements)  
**Priority**: LOW (core already works)

### Implementation Tasks
1. Add agent avatar/initials to deal cards (right side)
2. Add overdue indicator (🔺) to cards if payment is overdue
3. Ensure "Show: Active only" filter works (filter out COMPLETED/CANCELLED)
4. Add search integration (already exists?)
5. Ensure card click opens Deal Cockpit (should already work)

---

## 5. Deal Cockpit (Command Center)

### Wireframe Requirements
- Two-column layout:
  - **Left**: Activity timeline + notes input + task creation
  - **Right**: Deal summary + payment progress + documents + primary action button
- Deal header: "← Back to Deals | Deal #1"
- Deal summary: Buyer, Unit, Price, Broker, Start date
- Payment progress bar showing % + milestone list
- Each milestone shows: label + amount + status badge + due date
- Action buttons per milestone (Record Payment, etc.)
- Documents section: list + upload button
- Primary action button (stage-contextual):
  - RESERVATION_PENDING → "Record Reservation Fee"
  - RESERVATION_CONFIRMED → "Generate SPA" / "Record Payment"
  - SPA_PENDING → "Send SPA"
  - SPA_SENT → "Upload Signed SPA"
  - OQOOD_PENDING → "Mark OQOOD Registered"
  - INSTALLMENTS_ACTIVE → "Record Next Payment"
  - HANDOVER_PENDING → "Complete Handover"
- Activity timeline showing notes, payments, documents
- Quick note input at top: "Add a note... " + Enter

### Current Implementation
- ✅ DealDetailPage exists (2134 lines)
- ✅ Tabs system (now: Timeline / Payments / Activity / Tasks / History)
- ✅ Payment schedule table
- ⚠️ Layout may not be true two-column (left/right split)
- ✅ Quick note input (A5 completed)
- ✅ Primary action buttons (A4 completed, stage-aware)
- ✅ Document browser
- ⚠️ Activity timeline exists but may not match wireframe exactly
- ⚠️ Deal summary details may need consolidation

### Gap Summary
**Effort**: 1-2 days (layout refactor to two-column)  
**Priority**: MEDIUM-HIGH (UX improvement for main deal workflow)

### Implementation Tasks
1. Refactor DealDetailPage from single-column + tabs to **two-column layout**:
   - Left: 60% - Activity timeline, notes, tasks
   - Right: 40% - Summary, payments, documents, primary action
2. Move Timeline tab content to left column (visual timeline)
3. Move Payment milestone list to right column
4. Consolidate deal summary (buyer, unit, price, broker, start date) at top of right column
5. Ensure primary action button is prominent (sticky or at top of right column)
6. Responsive: Stack columns on mobile (left first, then right)

### Design Notes
- Left column should have Activity feed with infinite scroll
- Right column should have sticky summary (doesn't scroll away)
- Primary action button should use stage-based color (emerald/blue/orange/violet)
- Payment milestones should highlight if overdue (red background)

---

## 6. Finance Dashboard

### Wireframe Requirements
- Overview cards (3): Total Receivable + Overdue Amount + Collected This Month
- Recent Payments table: Date | Deal | Amount | Method | Status
- Overdue Deals alert section with: deal #, payment details, late fee, "View Deal" + "Send Reminder"
- Later: Commission queue, Broker statements

### Current Implementation
- ✅ FinanceDashboard exists (431 lines)
- ✅ KPI cards (overview metrics)
- ✅ Tabs: Overview / Overdue / Upcoming / Pipeline
- ✅ Color-coded status (alerts)
- ⚠️ Exact layout may differ from wireframe

### Gap Summary
**Effort**: 0.5 days (minor layout refinement)  
**Priority**: LOW

### Implementation Tasks
1. Ensure top cards match wireframe design (3 cards: Total Receivable, Overdue, Collected This Month)
2. Verify Recent Payments table exists and shows all columns
3. Verify Overdue Deals section shows: deal #, late fee, action buttons
4. Ensure color coding is consistent with STATUS_COLORS constants

---

## Summary: Implementation Roadmap

### Phase B: Wireframe Implementation (5-7 days)

| Task | File(s) | Effort | Priority | Status |
|------|---------|--------|----------|--------|
| Unit Matrix Grid | UnitsPage.tsx | 2-3d | HIGH | Not started |
| Leads Card Layout | LeadsPage.tsx | 1d | MEDIUM | Not started |
| Lead Detail + Offer Modal | LeadProfilePage.tsx + CreateOfferModal | 1-2d | HIGH | Partial |
| Kanban Refinement | DealsKanban.tsx | 0.5d | LOW | Mostly done |
| Deal Cockpit Two-Column | DealDetailPage.tsx | 1-2d | MEDIUM-HIGH | Not started |
| Finance Dashboard Polish | FinanceDashboard.tsx | 0.5d | LOW | Mostly done |

**Total: 6-9 days** (parallel work possible)

### Critical Path
1. **Unit Matrix Grid** (2-3d) — Core sales workflow, blocks offer creation
2. **Deal Cockpit Two-Column** (1-2d) — Improves deal management UX
3. **Lead Detail + Offer Modal** (1-2d) — Critical conversion flow
4. **Kanban + Finance Polish** (1d) — Fine-tuning

---

## Questions for User

1. **Two-column Deal Cockpit**: Should left column (timeline) and right column (summary/payments) each scroll independently, or scroll together? (Recommend: left scrolls, right sticky)

2. **Unit Matrix Filters**: Should floor navigation be a sidebar or dropdown? (Wireframe suggests tabs: [Floor: All | G | 1 | 2 | ...])

3. **Overdue Styling**: Should overdue payments be highlighted in red? (Wireframe suggests red background for overdue cells)

4. **Primary Action Placement**: Should the primary action button be:
   - Top of right column (sticky)?
   - Bottom of right column?
   - Or in the header with other CTAs?

5. **Mobile Layout**: For Deal Cockpit two-column on mobile:
   - Stack vertically (left, then right)?
   - Tabs to toggle between left/right?
   - Horizontal scroll?

