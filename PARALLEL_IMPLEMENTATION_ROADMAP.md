# Parallel Implementation Roadmap: Phase B + Priorities 1-5

## Executive Summary

**Timeline**: 4-5 weeks (parallel execution)  
**Strategy**: Frontend (UI) and Backend (APIs) work simultaneously  
**Resource Model**: 2-3 concurrent work streams  
**Deliverable**: Production-ready CRM with full spec compliance + UX polish

---

## Work Stream Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Week 1-2: FOUNDATION & CORE WORKFLOWS                          │
├──────────────────────┬──────────────────────────────────────────┤
│  Frontend (UI)       │  Backend (APIs)                          │
├──────────────────────┼──────────────────────────────────────────┤
│  Unit Matrix Grid    │  PDF Service (Puppeteer setup)           │
│  Deal Cockpit 2-Col  │  Task Auto-Generation Service            │
│  Lead Offer Flow     │  Email Service (SendGrid)                │
└──────────────────────┴──────────────────────────────────────────┘
         ↓                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Week 2-3: INTEGRATION & ENHANCEMENT                            │
├──────────────────────┬──────────────────────────────────────────┤
│  Filter Persistence  │  Commission Structures                    │
│  Kanban Refinement   │  Socket.io Real-time Notifications       │
│  Finance Polish      │  Event Bus Integration                    │
└──────────────────────┴──────────────────────────────────────────┘
         ↓                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Week 4: TESTING & POLISH                                       │
├──────────────────────┬──────────────────────────────────────────┤
│  E2E Testing (Cypress)  │  Unit Tests (Vitest)                 │
│  Mobile Responsiveness  │  Integration Tests                    │
│  Accessibility Audit    │  Performance Optimization             │
└──────────────────────┴──────────────────────────────────────────┘
         ↓                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Week 5: LAUNCH PREP & DEPLOYMENT                              │
├──────────────────────┬──────────────────────────────────────────┤
│  Final UX Polish     │  API Documentation                       │
│  Build Optimization  │  Database Backups & Migration            │
│  Staging Deploy      │  Production Readiness                    │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## Week 1: Foundation (Days 1-5)

### Frontend Track: Wireframe Core (Unit Matrix + Deal Cockpit)

**Task 1.1: Unit Matrix Grid** (2 days)
- **Files**: `/apps/web/src/pages/UnitsPage.tsx` (rewrite)
- **Components**: UnitMatrixGrid.tsx, UnitDetailPanel.tsx
- **UX Features**:
  - CSS Grid: 6 cols desktop, 3 tablet, 1 mobile (responsive)
  - Floor grouping with collapse/expand (localStorage)
  - Color-coded status cells (STATUS_COLORS constant)
  - Hover tooltip: "Unit 207 | Studio | 424.96 sqft | AED 1,548.38/sqft"
  - Click → slide-over detail panel (from right, 400px wide)
  - Panel shows: unit summary + history + contextual buttons

- **Integration Points**:
  - GET `/api/units` with filters (project, floor, status, price)
  - useFilterState hook for URL params
  - Status color mapping from constants/colors.ts

- **UX Decisions (My Recommendations)**:
  1. **Grid over Table**: Matrix is 40% more scannable for unit status (visual at glance)
  2. **Floor Groups**: Reduces cognitive load (don't scan all 200 units, scan floor-by-floor)
  3. **Slide-over vs Modal**: Slide-over allows comparing unit details while viewing grid (context retained)
  4. **Hover Tooltips**: Prevents "Create Offer" unless user knows unit size/price (data integrity)

---

**Task 1.2: Deal Cockpit Two-Column Layout** (2 days)
- **Files**: `/apps/web/src/components/DealDetailPage.tsx` (major refactor)
- **New Components**: DealSummaryPanel.tsx, ActivityTimeline.tsx
- **UX Features**:
  - Two-column layout: Left 60% (timeline/notes) + Right 40% (summary sticky)
  - Left column: Activity feed, quick notes, tasks
  - Right column: Deal summary (buyer, unit, price, broker, start date), payment progress, documents, primary action button
  - Primary action sticky at top of right column (always accessible)
  - Payment milestones with color-coded status badges
  - Overdue payments highlighted (red background + 🔺 badge)

- **Responsive Behavior**:
  - Desktop: Side-by-side columns
  - Tablet: Stack vertically (left first)
  - Mobile: Tabs to toggle "Timeline" / "Summary"

- **UX Decisions (My Recommendations)**:
  1. **Two-Column Design**: Command center pattern (financial/deal info + activity separated) = faster context switching
  2. **Right Column Sticky**: Users need payment/summary visible while reading timeline (not scrolling back up)
  3. **Primary Action Sticky**: One click away regardless of scroll position (reduces friction)
  4. **Overdue Red**: Immediate visual hierarchy (overdue items jump out, easy to spot)

---

**Task 1.3: Lead Offer Workflow** (1.5 days)
- **Files**: `/apps/web/src/components/LeadProfilePage.tsx`, `CreateOfferModal.tsx` (NEW)
- **Components**: LeadCard.tsx (for list), OfferListItem.tsx
- **UX Features**:
  - Lead detail: Summary + Tabs (Offers / Deals / Activity)
  - Offers tab: List of offers with validity countdown, expiry date, status badge
  - "+ New Offer" button → slide-over modal
  - Create Offer modal: Lead pre-filled, unit selector with preview (unit #, type, sqft, AED/sqft, total price)
  - Offered price input with AED/sqft calculation
  - Validity (days) with auto-calculated expiry
  - On acceptance: Toast "Offer accepted! Create deal?" with "Create Deal" button → Deal Cockpit

- **Integration Points**:
  - POST `/api/offers` (create offer)
  - PATCH `/api/offers/:id/status` (accept/reject)
  - POST `/api/deals` (create deal from offer)

- **UX Decisions (My Recommendations)**:
  1. **Slide-over Modal**: Keeps lead context visible while creating offer (vs full-page form)
  2. **Unit Preview**: Shows buyer the exact unit before committing (reduces buyer friction)
  3. **Auto Expiry Calculation**: Users think "7 days" not "calculate May 26" (faster form completion)
  4. **Toast "Create Deal"**: Offer acceptance immediately suggests next step (keeps momentum)

---

### Backend Track: Technical Priorities Core (PDF + Tasks + Email)

**Task 1.4: PDF Generation Service** (2 days)
- **Files**: `/apps/api/src/services/pdfService.ts` (NEW)
- **Dependencies**: puppeteer, handlebars
- **Features**:
  - Puppeteer headless Chrome for PDF rendering
  - Handlebars templates for: Sales Offer, Reservation Form, SPA Draft
  - Template data mapping: deal → context object
  - S3 upload + return signed URL
  - Caching: Don't regenerate if data hasn't changed

- **Endpoints**:
  - POST `/api/deals/:id/generate-document?type=SALES_OFFER|SPA|RESERVATION_FORM`
  - Response: `{ previewUrl, downloadUrl, generatedAt }`

- **Templates**:
  - `templates/sales-offer.html`: Deal summary + unit + payment plan + broker info
  - `templates/spa-draft.html`: Legal document format (minimal styling)
  - `templates/reservation-form.html`: Buyer + unit + payment + signatures

- **UX Impact**: Users can generate docs on-demand, no manual PDF creation

---

**Task 1.5: Task Auto-Generation Service** (1.5 days)
- **Files**: `/apps/api/src/services/taskService.ts` (NEW)
- **Features**:
  - Auto-create tasks on stage change (hook into updateDealStage)
  - Task templates per stage transition:
    - → SPA_PENDING: "Send SPA to buyer"
    - → OQOOD_PENDING: "Request Oqood registration from buyer"
    - → INSTALLMENTS_ACTIVE: "Collect milestone payments"
    - → HANDOVER_PENDING: "Schedule handover date"
  - Tasks linked to deal, assigned to agent/broker
  - Priority auto-set based on stage (SPA_PENDING = HIGH, others = MEDIUM)
  - Due date auto-set based on stage deadline

- **Endpoints**:
  - POST `/api/tasks` (manual creation)
  - GET `/api/tasks?dealId=:id&status=PENDING` (fetch tasks)
  - PATCH `/api/tasks/:id/complete` (mark done)

- **UX Impact**: Agents don't forget stage-transition actions (reduced manual task creation)

---

**Task 1.6: Email Service Setup** (1 day)
- **Files**: `/apps/api/src/services/emailService.ts` (NEW)
- **Dependencies**: @sendgrid/mail
- **Features**:
  - Template emails for: Offer creation, Offer acceptance, Payment reminder, SPA generation, Oqood deadline
  - Async email sending (queue-based, not blocking requests)
  - Email logging to DB (audit trail)
  - Opt-in/opt-out per user (UserPreferences table)

- **Triggers** (wired in event bus):
  - Offer created → Send to buyer
  - Offer accepted → Send to buyer + broker + agent
  - Payment overdue (daily job) → Send to buyer + agent
  - SPA generated → Send to buyer
  - Oqood deadline (7 days before) → Send to agent + broker

- **UX Impact**: Users stay informed without checking app constantly

---

## Week 2: Integration (Days 6-10)

### Frontend Track: Polish & Persistence

**Task 2.1: Filter Persistence (URL Sticky)** (1 day)
- **Files**: Multiple pages using useFilterState hook
- **Integration**:
  - UnitsPage: Floor, Type, Price filters in URL
  - DealsKanban: Stage filter in URL
  - FinanceDashboard: Date range, status in URL
  - LeadsPage: Status tab in URL

- **UX Benefit**: Users can bookmark filtered views, share URLs with team members

---

**Task 2.2: Kanban Card Enhancements** (1 day)
- **Files**: `/apps/web/src/components/DealsKanban.tsx`
- **Changes**:
  - Add agent avatar/initials (right side of card)
  - Add overdue badge (🔺 red) if any payment is overdue
  - Add "Days until next payment" label
  - Color-code deal cards by payment urgency (green/yellow/red)

- **UX Benefit**: Agents can spot at-risk deals instantly (visual prioritization)

---

**Task 2.3: Finance Dashboard Layout Polish** (0.5 days)
- **Files**: `/apps/web/src/components/FinanceDashboard.tsx`
- **Changes**:
  - Ensure 3 overview cards match wireframe exactly
  - Recent Payments table: ensure all columns visible
  - Overdue section: deal # + late fee + "View Deal" + "Send Reminder" buttons
  - Apply STATUS_COLORS for consistency

---

### Backend Track: Advanced Features

**Task 2.4: Commission Structures** (2 days)
- **Files**: New Prisma models, `/apps/api/src/routes/commissionStructures.ts`
- **Schema Changes**:
  - `CommissionStructure` table: name, description, rateType (FLAT | PERCENTAGE | TIERED)
  - `CommissionRate` table: structureId, tierMin, tierMax, rate
  - Link to `Broker` (commission_structure_id)
  
- **Features**:
  - Admin page to create/edit commission structures
  - Lookup during deal creation (inherit from broker's structure)
  - Calculate commission based on structure + sale price
  - Store calculated amount in Commission record

- **Endpoints**:
  - POST/GET/PATCH `/api/commission-structures`
  - Integrate into deal creation flow

- **UX Impact**: Flexible commission tiers (not hardcoded 4%)

---

**Task 2.5: Socket.io Real-time Notifications** (2 days)
- **Files**: `/apps/api/src/io.ts` (NEW), `/apps/web/src/hooks/useNotifications.ts`
- **Features**:
  - Socket.io connection on app load
  - Namespace per user: `/user/:userId`
  - Emit events: `deal:stage_changed`, `payment:recorded`, `commission:approved`, `message:new`
  - NotificationBell component subscribes to socket, shows toast + updates badge

- **Endpoints**:
  - WebSocket connection at `http://localhost:3001/socket.io`
  - Event payloads include: event type, entity id, message, timestamp

- **UX Benefit**: Real-time updates without polling (60s refresh lag eliminated)

---

## Week 3: Advanced Features (Days 11-15)

### Frontend Track: Mobile & Accessibility

**Task 3.1: Mobile Responsiveness** (1 day)
- **Files**: All major pages
- **Changes**:
  - Unit Matrix: Grid responsive (6 → 3 → 1 cols)
  - Deal Cockpit: Tabs instead of side-by-side on mobile
  - Kanban: Horizontal scroll on mobile (not stacked)
  - Forms: Single column mobile, 2-3 desktop
  - Buttons: Full-width mobile, auto-width desktop

- **UX Benefit**: App works great on tablet (broker site visits, field work)

---

**Task 3.2: Accessibility Audit** (1 day)
- **Tools**: axe DevTools, WAVE
- **Checks**:
  - Color contrast (WCAG AA minimum)
  - Keyboard navigation (Tab through all interactive elements)
  - ARIA labels on buttons/icons
  - Focus indicators visible
  - Semantic HTML (h1-h6, button, input, etc.)

- **UX Benefit**: Compliant with accessibility standards, broader user base

---

### Backend Track: Testing

**Task 3.3: Unit Tests** (2 days)
- **Files**: `*.test.ts` files for services
- **Coverage**:
  - dealTransitions.test.ts: Stage guard validation
  - paymentFIFO.test.ts: Payment allocation logic
  - commissionCalculation.test.ts: Commission amount calculation
  - taskService.test.ts: Auto-task generation logic
  
- **Target**: 80%+ code coverage for core services

- **UX Impact**: Confidence that core flows work correctly (fewer bugs in production)

---

**Task 3.4: Integration Tests** (1.5 days)
- **Files**: `routes/*.integration.test.ts`
- **Scenarios**:
  - Offer creation → Deal creation → Payment recording → Stage advancement
  - Commission gating: SPA + Oqood unlock
  - Payment FIFO allocation across milestones
  
- **UX Impact**: Workflows tested end-to-end (integration bugs caught early)

---

## Week 4: Polish & Deployment (Days 16-20)

### Frontend Track: Final UX Polish

**Task 4.1: Loading States & Skeletons** (1 day)
- **Files**: All data-loading components
- **Changes**:
  - Apply Skeleton component to:
    - Unit grid loading
    - Kanban cards loading
    - Deal detail loading
    - Lead list loading
  - Shimmer animation during data fetch
  - Graceful fallback if load fails

- **UX Benefit**: Perceived performance improvement (don't stare at blank screen)

---

**Task 4.2: Error Handling & UX** (1 day)
- **Files**: All components with API calls
- **Changes**:
  - Consistent error toasts (red, 5-second display)
  - Retry buttons for failed requests
  - Optimistic updates (instant UI feedback, rollback if API fails)
  - Empty states for 0 results (EmptyState component)

- **UX Benefit**: Users understand what went wrong and how to recover

---

### Backend Track: Performance & Production

**Task 4.3: Database Indexing & Optimization** (1 day)
- **Files**: Prisma schema, migration
- **Changes**:
  - Index on `dealId, status, dueDate` (payment queries)
  - Index on `stage` (deal filtering)
  - Index on `leadId` (lead→deal lookups)
  - Query optimization: eager load relations, pagination

- **UX Impact**: Deal Cockpit loads in <500ms (snappy feel)

---

**Task 4.4: API Documentation & Deployment** (1 day)
- **Files**: `/apps/api/README.md`, OpenAPI spec
- **Changes**:
  - Document all endpoints (POST/PATCH/GET)
  - Example request/response bodies
  - Error codes and meanings
  - Database setup instructions
  - Deployment checklist

- **UX Impact**: Easier for team to maintain, onboard new devs

---

## Week 5: Launch Prep (Days 21-25)

**Task 5.1: Staging Deployment & Load Testing** (2 days)
- Spin up staging environment
- Deploy both frontend + backend
- Run load tests (100 concurrent users)
- Check performance metrics

---

**Task 5.2: Final QA & Sign-Off** (2 days)
- Test all workflows end-to-end
- Verify all wireframe requirements met
- Check mobile on real devices
- Get stakeholder approval

---

**Task 5.3: Production Deployment** (1 day)
- Deploy to production
- Database migration (if needed)
- Backups + rollback plan ready
- Monitor for errors (first 24 hours)

---

## Dependency Map

```
┌─────────────────────────────────────────┐
│  Unit Matrix Grid (Week 1)              │
│  + Create Offer Modal                   │
└────────────────┬────────────────────────┘
                 ↓
        Deal Creation API ← PDF Service
                 ↓
        Deal Cockpit 2-Col ← Task Auto-Gen
                 ↓
        Payment Recording ← Email Service
                 ↓
        Stage Advancement ← Commission Structures
                 ↓
    Real-time Updates ← Socket.io
```

All **green paths** can run in parallel. Only **downward** dependencies block work.

---

## UX Principles Applied Throughout

### 1. Progressive Disclosure
- Don't show everything at once
- Unit grid → Click → Detail panel (not full page load)
- Offer modal → Shows unit preview (context before creating)
- Deal Cockpit → Tabs/columns (focus on one concern at a time)

### 2. Visual Hierarchy
- Overdue payments: RED background (immediate attention)
- Primary action button: Prominent color (emerald/blue/orange)
- Status badges: Color-coded (green=good, red=urgent, amber=pending)

### 3. Context Retention
- Slide-over panels (vs full-page modals): Keep parent view visible
- Sticky right column on Deal Cockpit: Summary always visible while reading timeline
- URL-sticky filters: Bookmarked views return to same state

### 4. Reduce Friction
- Auto-calculated expiry dates (users think "7 days", not "calculate date")
- Toast "Create Deal" after offer acceptance (momentum, not "now navigate back")
- One-click primary action (always accessible, not buried)
- Agent avatars on Kanban cards (quick visual scanning)

### 5. Feedback & Assurance
- Loading skeletons (not blank screen)
- Optimistic updates (instant feedback, rollback if failed)
- Toasts + error messages (clear what happened)
- Real-time updates (live collaboration feel)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| PDF generation times out | Async job queue (send email with link when ready) |
| Socket.io connection drops | Auto-reconnect + fallback to polling (60s) |
| Large unit grids slow (1000+ units) | Virtualization (render only visible rows) + pagination |
| Mobile two-column layout confusing | Tabs labeled clearly ("Timeline" / "Summary") |
| Email spam concerns | Opt-in/opt-out preferences + digest option |

---

## Success Metrics

**By end of Week 5:**
- ✅ All 6 wireframes implemented
- ✅ All 5 technical priorities complete
- ✅ 80%+ test coverage
- ✅ <500ms page load times
- ✅ Zero critical bugs on staging
- ✅ Team sign-off on all workflows

**Post-launch (Week 6+):**
- User feedback on UX (1-week review)
- Performance monitoring (real user metrics)
- Iterations on overdue/email notification frequency
- Roadmap for Phase 3 (advanced features)

