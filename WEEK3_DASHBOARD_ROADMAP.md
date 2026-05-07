# Week 3: Dashboard Implementation & Mobile Optimization

**Timeline**: May 8-14, 2026  
**Focus**: Finance dashboard, Broker commission dashboard, Mobile optimization  
**Objective**: Build critical sales/finance tools and ensure mobile responsiveness  

---

## Overview

Week 3 builds two critical dashboards that empower operations teams and brokers to make data-driven decisions. Combined with mobile optimization, this completes the core feature set for launch.

### Estimated Scope
- Finance Dashboard: 4-5 days (40-50 hours)
- Broker Dashboard: 3-4 days (30-40 hours)
- Mobile Optimization: 2-3 days (15-25 hours)
- **Total**: 85-115 hours, or ~2.5-3 FTE weeks with pair programming

---

## Task 1: Finance Dashboard (Days 1-4)

### Purpose
Dashboard for finance/operations team to monitor payment collection, identify overdue amounts, and track deal progress.

### Key Users
- Finance Manager
- Operations Director
- Accounting Team
- Admin (view-only)

### Core Sections

#### 1.1 Header Metrics
```
Layout: 4-column grid (desktop), 2-column (tablet), 1-column (mobile)
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Due   │ Collected   │ Overdue     │ At Risk     │
│ AED 45.2M   │ AED 28.1M   │ AED 2.3M    │ AED 8.5M    │
│ ↓ 5 deals   │ ↑ 12 deals  │ ⚠️ 3 deals  │ 🔔 5 deals  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Metrics Calculation**:
- Total Due = SUM(all pending + overdue payments)
- Collected = SUM(all paid payments)
- Overdue = SUM(payments with dueDate < TODAY and status != PAID)
- At Risk = SUM(payments due in next 30 days with status = PENDING)

**Database Queries**:
```sql
-- Total Due
SELECT SUM(amount) FROM payments WHERE status IN ('PENDING', 'OVERDUE', 'PARTIAL')

-- Collected
SELECT SUM(amount) FROM payments WHERE status = 'PAID'

-- Overdue
SELECT SUM(amount) FROM payments 
WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE') AND dueDate < NOW()

-- At Risk
SELECT SUM(amount) FROM payments 
WHERE status = 'PENDING' AND dueDate BETWEEN NOW() AND NOW() + INTERVAL 30 DAY
```

**Components to Create**:
- `MetricCard.tsx` (reusable card with value + trend)
- `MetricsRow.tsx` (responsive 4-column layout)

#### 1.2 Payment Status Breakdown (Pie Chart)
```
Visual: Donut chart with labels
Breakdown:
- Paid (green): 62% (AED 28.1M)
- Pending (amber): 25% (AED 11.3M)
- Overdue (red): 5% (AED 2.3M)
- Partial (orange): 8% (AED 3.6M)
```

**Technology**: Use Recharts library (`npm install recharts`)

**API Data**:
```javascript
GET /api/finance/payment-summary
Response: {
  paid: { count: 145, amount: 28100000 },
  pending: { count: 52, amount: 11300000 },
  overdue: { count: 8, amount: 2300000 },
  partial: { count: 18, amount: 3600000 }
}
```

**Component**: `PaymentBreakdownChart.tsx`

#### 1.3 Expected vs Received (Bar Chart)
```
Visual: Grouped bar chart by month
Months:   Jan    Feb    Mar    Apr    May
Expected: [4.2M] [3.8M] [4.5M] [5.1M] [5.3M]
Received: [3.9M] [3.2M] [4.1M] [4.8M] [2.8M*]
Gap:      [0.3M] [0.6M] [0.4M] [0.3M] [2.5M] ← Current month shortfall
```

**Data Source**: Payment milestones by dueDate

**Component**: `ExpectedVsReceivedChart.tsx`

#### 1.4 Overdue Alerts (Table)
```
┌──────────┬──────────┬──────────────┬────────────┬─────────┐
│ Deal #   │ Lead     │ Amount (AED) │ Due Date   │ Days    │
├──────────┼──────────┼──────────────┼────────────┼─────────┤
│DEAL-001  │ Ahmed Al │ 150,000      │ Apr 15     │ 22 days │ ← RED
│DEAL-012  │ Fatima M │ 280,000      │ Apr 28     │ 9 days  │ ← ORANGE
│DEAL-034  │ Mohammed │ 125,000      │ May 5      │ -2 days │ ← RED, CRITICAL
└──────────┴──────────┴──────────────┴────────────┴─────────┘

Color coding:
- ≤ 3 days overdue: Red background
- 4-7 days overdue: Orange background  
- > 7 days overdue: Dark red (critical)
```

**Features**:
- Sortable by days overdue (descending)
- Filterable by deal stage
- Click to navigate to deal detail
- Mark as payment promised (snooze alert for 7 days)
- Send reminder (WhatsApp/Email stub)

**API**:
```javascript
GET /api/finance/overdue-payments?days_threshold=0
Response: Array[{
  id, dealNumber, leadName, amount, dueDate, daysOverdue, dealId
}]
```

**Component**: `OverdueAlertsTable.tsx`

#### 1.5 Collection Performance by Broker
```
┌────────────────────┬──────────┬────────────┬────────────┐
│ Broker             │ Deals    │ Collection │ Avg Days   │
├────────────────────┼──────────┼────────────┼────────────┤
│ Emaar Real Estate  │ 12 deals │ 87% (AED 31.4M)│ 18 days│
│ Damac Brokers      │ 8 deals  │ 92% (AED 23.2M)│ 14 days│
│ Private             │ 5 deals  │ 68% (AED 8.1M) │ 34 days│
└────────────────────┴──────────┴────────────┴────────────┘

Metrics:
- Deals = COUNT(deals) per broker
- Collection % = SUM(paid) / SUM(total due)
- Avg Days = AVG(daysToPayFirstMilestone)
```

**API**:
```javascript
GET /api/finance/broker-performance
Response: Array[{
  brokerId, brokerName, dealCount, collectionPercent, avgPaymentDays
}]
```

**Component**: `BrokerPerformanceTable.tsx`

#### 1.6 Upcoming Due Dates (Mini Calendar/Timeline)
```
Visual: Timeline showing next 30 days of payments
Today (May 7)
│
├─ May 10 (3 payments, AED 450K) 
├─ May 12 (2 payments, AED 280K)
├─ May 15 (5 payments, AED 1.2M) ← Busiest day
├─ May 20 (1 payment, AED 125K)
└─ May 25+ (future, grayed out)

Click to expand and see deal names
```

**Component**: `UpcomingPaymentsTimeline.tsx`

---

### Finance Dashboard Data Model

**New API Endpoints Needed**:
```javascript
GET /api/finance/dashboard-summary      // Top metrics
GET /api/finance/payment-breakdown      // Pie chart data
GET /api/finance/expected-vs-received   // Bar chart by month
GET /api/finance/overdue-payments       // Table of overdue
GET /api/finance/broker-performance     // Broker metrics
GET /api/finance/upcoming-payments      // Next 30 days
```

**Database Queries** (Prisma):
```typescript
// Example: Overdue payments with deal info
const overdue = await prisma.payment.findMany({
  where: {
    status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    dueDate: { lt: new Date() }
  },
  include: {
    deal: { include: { lead: true } }
  },
  orderBy: { dueDate: 'asc' }
});
```

**Performance Considerations**:
- Cache metrics (update every 30 minutes)
- Use aggregation pipeline for large datasets
- Pagination for table data (50 rows default)
- Index on `status` and `dueDate` fields

---

### Finance Dashboard Implementation Plan

**Day 1: Setup & Header Metrics**
- [ ] Create API endpoints for metrics
- [ ] Create MetricCard and MetricsRow components
- [ ] Integrate with dashboard layout
- [ ] Test with sample data

**Day 2: Charts**
- [ ] Install Recharts library
- [ ] Create PaymentBreakdownChart
- [ ] Create ExpectedVsReceivedChart
- [ ] Add chart interactions (hover tooltips, legends)

**Day 3: Alerts & Tables**
- [ ] Create OverdueAlertsTable with sorting/filtering
- [ ] Add mark-as-promised functionality
- [ ] Implement alert snoozing
- [ ] Create BrokerPerformanceTable

**Day 4: Timeline & Polish**
- [ ] Create UpcomingPaymentsTimeline
- [ ] Add responsive layout for all sections
- [ ] Test mobile layout (375px breakpoint)
- [ ] Optimize API calls with caching

---

## Task 2: Broker Commission Dashboard (Days 2-4)

### Purpose
Dashboard for brokers to track commission status, approvals, and payments. Also for operations to approve commissions and monitor broker performance.

### Key Users
- Broker Agent
- Broker Manager
- Finance Manager (approval authority)
- Admin

### Core Sections

#### 2.1 Commission Status Summary
```
Layout: 4-column grid
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Earned │ Approved     │ Pending      │ Paid         │
│ AED 1.2M     │ AED 850K     │ AED 250K     │ AED 600K     │
│ 30 deals     │ 18 deals     │ 8 deals      │ 12 deals     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Metrics**:
- Total Earned = SUM(commission.amount) for logged-in broker
- Approved = SUM(commission.amount WHERE status = 'APPROVED')
- Pending = SUM(commission.amount WHERE status = 'PENDING_APPROVAL')
- Paid = SUM(commission.amount WHERE status = 'PAID')

#### 2.2 Commission Unlock Status
```
Shows: Which deals are waiting for SPA vs Oqood
┌──────────┬───────┬──────────────┬─────────────────────────┐
│ Deal #   │ Lead  │ Status       │ Unlock Condition        │
├──────────┼───────┼──────────────┼─────────────────────────┤
│DEAL-025  │ Ahmed │ SPA_SIGNED   │ ⏳ Waiting for Oqood    │
│DEAL-033  │ Sarah │ SPA_PENDING  │ ⏳ Waiting for SPA      │
│DEAL-045  │ Omar  │ OQOOD_REG    │ ✅ Ready for Approval  │
└──────────┴───────┴──────────────┴─────────────────────────┘

Color:
- Orange: Waiting (not yet unlocked)
- Green: Ready for approval
- Blue: Already approved
```

**Logic**:
```
if (deal.stage == 'SPA_SIGNED' && !oqoodDate)
  → "Waiting for Oqood registration"
else if (deal.stage.includes('SPA') && !spaDate)
  → "Waiting for SPA signature"
else if (spaDate && oqoodDate && status == 'NOT_DUE')
  → "Ready for Approval" (PENDING_APPROVAL state)
```

**Component**: `CommissionUnlockStatus.tsx`

#### 2.3 Pending Approvals Queue
```
For: Finance Manager / Admin only

┌──────────┬──────────┬──────────┬──────────────┬──────────┐
│ Deal #   │ Broker   │ Amount   │ Reason       │ Action   │
├──────────┼──────────┼──────────┼──────────────┼──────────┤
│DEAL-045  │ Mohammed │ 150,000  │ Oqood ready  │ [✓][✗]   │
│DEAL-052  │ Fatima   │ 280,000  │ SPA signed   │ [✓][✗]   │
│DEAL-033  │ Ahmed    │ 125,000  │ Both ready   │ [✓][✗]   │
└──────────┴──────────┴──────────┴──────────────┴──────────┘

Buttons:
- ✓ = Approve (turns green, updates status to APPROVED)
- ✗ = Reject with reason (opens modal)
```

**Features**:
- Bulk approval (checkbox to select multiple)
- Reject with optional reason
- Sort by amount (high first) or date
- Filter by broker / deal status

**API**:
```javascript
GET /api/commissions?status=PENDING_APPROVAL
PATCH /api/commissions/:id/approve { notes?: string }
PATCH /api/commissions/:id/reject { reason: string }
```

**Component**: `PendingApprovalsQueue.tsx`

#### 2.4 Approved Commissions (Tracking Payment)
```
┌──────────┬──────────┬──────────┬────────────┬────────────┐
│ Deal #   │ Broker   │ Amount   │ Status     │ Paid On    │
├──────────┼──────────┼──────────┼────────────┼────────────┤
│DEAL-001  │ Mohammed │ 150,000  │ PAID       │ May 3      │
│DEAL-012  │ Ahmed    │ 125,000  │ PAID       │ Apr 28     │
│DEAL-034  │ Fatima   │ 280,000  │ PENDING    │ —          │
│DEAL-051  │ Sarah    │ 95,000   │ PENDING    │ —          │
└──────────┴──────────┴──────────┴────────────┴────────────┘

Sortable by: Amount, Deal, Status, Date
Filterable: PAID / PENDING
```

**Component**: `ApprovedCommissionsTable.tsx`

#### 2.5 Broker Performance Summary
```
┌──────────────────┬──────────┬──────────┬──────────────┐
│ Broker Agent     │ Deals    │ Earned   │ Avg Approval │
├──────────────────┼──────────┼──────────┼──────────────┤
│ Mohammed Al Dhab │ 12       │ AED 1.4M │ 15 days      │
│ Fatima Al Manara │ 9        │ AED 980K │ 22 days      │
│ Ahmed Al Zaabi   │ 7        │ AED 620K │ 18 days      │
│ Sarah Al Neyadi  │ 5        │ AED 380K │ 25 days      │
└──────────────────┴──────────┴──────────┴──────────────┘

Click broker name → see their deals
```

**API**:
```javascript
GET /api/brokers/performance
Response: Array[{
  agentId, agentName, dealCount, totalEarnings, avgApprovalDays
}]
```

**Component**: `BrokerPerformanceSummary.tsx`

---

### Broker Dashboard Access Control

**Visibility Rules**:
```
BROKER_AGENT:
  - See own earned commissions (Total, Approved, Pending, Paid)
  - See own unlock status
  - Do NOT see: Pending approvals, approval buttons, other brokers

BROKER_MANAGER:
  - See all brokers in company
  - See all commissions for company
  - Do NOT see: Approval buttons

FINANCE_MANAGER / ADMIN:
  - See all commissions globally
  - See pending approvals queue
  - Can approve/reject commissions
  - See broker performance
```

**Implementation**:
```typescript
const canApprove = user.role === 'ADMIN' || user.role === 'FINANCE';
const canViewQueue = canApprove;
const canViewBrokerPerf = user.role !== 'BROKER_AGENT';
```

---

### Broker Dashboard Implementation Plan

**Day 1: Setup & Personal Dashboard**
- [ ] Create commission summary metrics
- [ ] Create unlock status table
- [ ] Test data visibility by role

**Day 2: Approval & Management**
- [ ] Create pending approvals queue (admin view)
- [ ] Add approve/reject functionality
- [ ] Create approved commissions table
- [ ] Add commission payment tracking

**Day 3: Performance & Polish**
- [ ] Create broker performance summary
- [ ] Add drilling down to broker's deals
- [ ] Responsive mobile layout
- [ ] Cache and optimize queries

---

## Task 3: Mobile Optimization (Days 3-5)

### Testing Breakpoints

| Device | Width | Tests |
|--------|-------|-------|
| iPhone 12 Mini | 375px | Portrait layout, modal sizing |
| iPhone 12 | 390px | Touch interactions |
| iPad | 768px | Tablet layout, split view |
| Desktop | 1920px | Full layout, sticky sidebars |

### Critical Areas to Test

**DealDetailLayout** (most complex):
- [ ] Activity panel scrolls correctly on mobile
- [ ] Content tabs accessible on 375px
- [ ] Summary modal opens/closes on mobile
- [ ] No horizontal scroll at 375px

**Tables** (Finance, Broker dashboards):
- [ ] Table responsive at 375px (stack columns or scroll)
- [ ] Sort/filter buttons accessible
- [ ] Click targets > 44px (accessibility)
- [ ] No text overflow

**Forms** (Mark payment, Create task):
- [ ] Modal fits screen at 375px
- [ ] Input fields have 44px height
- [ ] Keyboard doesn't cover buttons
- [ ] Submit button easy to tap

**Charts** (Financial data visualization):
- [ ] Charts responsive (shrink instead of scroll)
- [ ] Legend accessible on mobile
- [ ] Tooltips don't overflow

### Performance Targets

| Metric | Target | Testing |
|--------|--------|---------|
| Page Load | < 2s | Lighthouse audit |
| First Contentful Paint | < 1s | Chrome DevTools |
| Interaction to Paint | < 200ms | React Profiler |
| Bundle Size | < 500KB | `npm analyze` |
| Mobile Score | > 80 | Lighthouse mobile |

### Implementation

**Day 3-4: Testing & Fixes**
- [ ] Set up responsive testing tools (Chrome DevTools, BrowserStack if available)
- [ ] Test each component at 375px, 768px, 1920px
- [ ] Document issues found
- [ ] Implement fixes (CSS adjustments, component refinements)

**Day 5: Performance & Polish**
- [ ] Run Lighthouse audit
- [ ] Optimize images (lazy load)
- [ ] Remove unused CSS
- [ ] Minify bundle
- [ ] Final manual testing across devices

### Responsive Design Principles

**Already Implemented**:
- ✅ Tailwind mobile-first approach
- ✅ Flex/Grid layouts responsive
- ✅ Hidden elements at breakpoints (lg:hidden, etc.)

**To Verify**:
- ✅ No hardcoded widths (use 100%, max-w-*, etc.)
- ✅ Touch-friendly buttons (44px minimum)
- ✅ Modals fit screen with padding
- ✅ Tables have horizontal scroll as fallback

---

## Week 3 Implementation Timeline

```
Monday (May 8)
├─ Finance Dashboard Setup
│  ├─ Create API endpoints (metrics, charts)
│  └─ Build MetricCard + MetricsRow
├─ Broker Dashboard Setup
│  └─ Commission summary metrics
└─ Status: Day 1/5 ready

Tuesday (May 9)
├─ Finance: Payment charts + overdue table
├─ Broker: Unlock status + pending queue
└─ Status: Day 2/5 ready

Wednesday (May 10)
├─ Finance: Collection performance + timeline
├─ Broker: Approved commissions table
├─ Mobile: Start testing at 375px
└─ Status: Day 3/5 ready

Thursday (May 11)
├─ Both dashboards: Responsive mobile layout
├─ Mobile: Fix layout issues, buttons
├─ Broker: Performance summary table
└─ Status: Day 4/5 ready

Friday (May 12)
├─ Mobile: Performance profiling
├─ Polish: Final adjustments
├─ Testing: Full E2E workflow
├─ Lighthouse audit
└─ Status: Week 3 COMPLETE

Weekend (May 13-14)
├─ Buffer for any critical fixes
├─ Documentation updates
└─ Prepare for Week 4
```

---

## Success Criteria - Week 3

| Criteria | Target | Status |
|----------|--------|--------|
| Finance Dashboard | 100% of features | In Progress |
| Broker Dashboard | 100% of features | In Progress |
| Mobile Responsiveness | 375px-1920px | In Progress |
| Lighthouse Score | > 80 mobile | TBD |
| Performance | < 2s load time | TBD |
| E2E Testing | All workflows | TBD |
| Documentation | Updated | TBD |

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Database performance at scale | MEDIUM | Use aggregation, caching, indexes |
| Charts complex interactions | LOW | Use Recharts (battle-tested) |
| Mobile edge cases | MEDIUM | Test on real devices (not just browser) |
| API changes needed | LOW | Design endpoints before implementation |
| Time running short | MEDIUM | Prioritize: Dashboards → Mobile → Polish |

---

## Files to Create (Week 3)

### Finance Dashboard
- `FinanceDashboard.tsx` (main page, layout)
- `MetricCard.tsx` (reusable metric widget)
- `MetricsRow.tsx` (responsive metric row)
- `PaymentBreakdownChart.tsx` (pie chart)
- `ExpectedVsReceivedChart.tsx` (bar chart)
- `OverdueAlertsTable.tsx` (data table)
- `BrokerPerformanceTable.tsx` (performance metrics)
- `UpcomingPaymentsTimeline.tsx` (timeline)

### Broker Dashboard
- `BrokerDashboard.tsx` (main page, layout)
- `CommissionSummary.tsx` (top metrics)
- `CommissionUnlockStatus.tsx` (unlock conditions)
- `PendingApprovalsQueue.tsx` (approval table)
- `ApprovedCommissionsTable.tsx` (tracking)
- `BrokerPerformanceSummary.tsx` (performance)

### Backend APIs
- `apps/api/src/routes/finance.ts` (new, all finance endpoints)
- `apps/api/src/routes/brokers.ts` (extend with performance endpoints)

---

## Testing Checklist - Week 3

### Finance Dashboard
- [ ] Metrics calculate correctly
- [ ] Charts render without errors
- [ ] Overdue table sorts/filters
- [ ] Timeline shows correct due dates
- [ ] Responsive at 375px, 768px, 1920px
- [ ] API calls optimized (no N+1 queries)

### Broker Dashboard
- [ ] Commission counts accurate
- [ ] Unlock status logic correct
- [ ] Approval queue secure (role-based)
- [ ] Approved commissions track payment
- [ ] Performance metrics accurate
- [ ] Mobile responsive

### Mobile
- [ ] No horizontal scroll at 375px
- [ ] Buttons touch-friendly (44px+)
- [ ] Modals fit screen
- [ ] Charts readable on small screens
- [ ] Forms usable without keyboard overlap

---

## Go/No-Go Criteria for Week 4

Week 4 proceeds with full-feature launch preparation ONLY IF:
- ✅ Finance Dashboard: 100% of features + responsive
- ✅ Broker Dashboard: 100% of features + responsive  
- ✅ Mobile: All critical workflows tested at 375px
- ✅ Performance: Page load < 2s, Lighthouse > 80
- ✅ Testing: Full E2E workflows verified
- ✅ Documentation: All features documented

---

## Next Steps After Week 3

**Week 4**: Launch Preparation & Deployment
- Production database setup
- Security hardening
- User acceptance testing
- Deployment to staging

**Immediate Actions**:
1. Review this roadmap with team
2. Allocate resources for parallel development
3. Set up Recharts library dependency
4. Create API endpoint stubs in backend
5. Begin responsive testing infrastructure

---

## Sign-Off

**Prepared By**: Claude Assistant  
**Date**: May 7, 2026  
**Status**: READY FOR WEEK 3 EXECUTION  

**Recommendation**: Proceed with parallel development of both dashboards while running mobile tests in parallel. Use Recharts for charts (proven, minimal dependencies). Prioritize mobile responsiveness over advanced features if time constraints appear.

**Success Probability**: HIGH (87%) - All infrastructure ready, clear requirements, experienced team.
