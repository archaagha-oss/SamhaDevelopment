# SamhaDevelopment CRM: Architecture & Code Standards

**Author**: Senior Architect (Claude)  
**Effective**: Week 1, Day 1  
**Scope**: Complete parallel implementation (Weeks 1-5)

---

## I. Core Principles

### 1. Type Safety First
- All TypeScript, strict mode enabled
- No `any` types (cast properly or fix upstream)
- Interfaces over types (consistency)
- Discriminated unions for state machines

### 2. Performance Over Features
- Paginate lists (50-item default, lazy load)
- Virtualize grids (1000+ items)
- Memoize expensive calculations
- Index database queries heavily
- Target <500ms FCP (First Contentful Paint)

### 3. Error Handling as Feature
- All async operations have try-catch
- User-friendly error messages (not stack traces)
- Audit trail for all failures (log + send to backend)
- Graceful degradation (feature works without JS if possible)

### 4. Architecture Patterns
- **Frontend**: React Query (state) + Context (auth) + Tailwind (styling)
- **Backend**: Express middleware stack → Prisma ORM → PostgreSQL
- **Services**: No god objects (single responsibility)
- **Testing**: Vitest (unit) + Cypress (E2E) + manual acceptance

### 5. Security & Validation
- Validate at boundaries only (API layer, user input)
- No sensitive data in logs or localStorage
- RBAC enforced at API + frontend
- SQL injection impossible (Prisma parameterized)
- XSS prevented (React escapes by default)

---

## II. Code Organization

### Frontend
```
/apps/web/src/
├── components/          # Reusable UI components
│   ├── Layout/         # AppShell, Sidebar, Header
│   ├── Common/         # Button, Modal, Form, etc.
│   ├── Kanban/         # Kanban-specific components
│   └── Deal/           # Deal Cockpit components
├── pages/              # Page-level containers
│   ├── UnitsPage.tsx
│   ├── LeadsPage.tsx
│   └── DealsPage.tsx
├── hooks/              # Custom hooks (useFilterState, useNotifications)
├── constants/          # colors.ts, stage configs, etc.
├── utils/              # Utilities (formatting, calculations)
├── types/              # Global TypeScript types
├── services/           # API service layer (axios wrapper)
└── styles/             # Global CSS (Tailwind config)
```

### Backend
```
/apps/api/src/
├── routes/             # API endpoints
│   ├── units.ts
│   ├── leads.ts
│   ├── offers.ts
│   ├── deals.ts
│   ├── payments.ts
│   ├── commissions.ts
│   ├── tasks.ts
│   └── auth.ts
├── services/           # Business logic
│   ├── dealService.ts
│   ├── paymentService.ts
│   ├── commissionService.ts
│   ├── pdfService.ts        (NEW)
│   ├── taskService.ts       (NEW)
│   └── emailService.ts      (NEW)
├── middleware/         # Auth, validation, error handling
├── lib/                # Database, logger, S3 client
├── schemas/            # Zod validation schemas
├── types/              # TypeScript interfaces
├── config/             # Stage rules, commission rates
├── jobs/               # Scheduled tasks (cron)
└── io.ts              # Socket.io setup (NEW)
```

---

## III. Quality Gates

### Before Every Commit
- [ ] Types check: `npx tsc --noEmit` (0 errors)
- [ ] Linting: `npm run lint` (0 errors)
- [ ] Tests pass: `npm run test` (new code has tests)
- [ ] No console.log in production code
- [ ] No hardcoded values (use constants/config)

### Before Every PR/Push
- [ ] Code review checklist (see below)
- [ ] Integration points documented
- [ ] Performance profile checked (no N+1 queries)
- [ ] Error scenarios tested

### Code Review Checklist
- [ ] Function does one thing (SRP)
- [ ] No side effects in pure functions
- [ ] Error handling present (try-catch or Error boundary)
- [ ] Performance: no unnecessary re-renders, queries efficient
- [ ] Security: no user input without validation
- [ ] Accessibility: semantic HTML, ARIA labels, focus management
- [ ] Testing: unit tests for logic, integration tests for flows

---

## IV. Integration Points (Critical Dependencies)

### Frontend → Backend
```
Unit Matrix Grid
  ↓ GET /api/units (with filters)
  ↓ PATCH /api/units/:id (change status)
  ↓ CREATE /api/offers (from detail panel)
  
Deal Cockpit
  ↓ GET /api/deals/:id (full context)
  ↓ PATCH /api/deals/:id/stage (drag-drop)
  ↓ PATCH /api/payments/:id/paid (mark paid)
  ↓ POST /api/deals/:id/generate-document (PDF)
  
Lead Offer
  ↓ POST /api/offers (create)
  ↓ PATCH /api/offers/:id/status (accept)
  ↓ POST /api/deals (from accepted offer)
```

### Backend Internal
```
Deal Creation
  → createDealService()
    → generatePaymentSchedule()
    → createCommission()
    → reserveUnit()
    → createInitialTasks()
    → emitEvent('deal:created')

Payment Recording
  → markPaymentPaid()
    → updatePaymentMilestone()
    → checkStageAdvancement()
    → updateDealStage() [if threshold met]
    → emitEvent('payment:received')
    → triggerEmailReminder()

Stage Advancement
  → updateDealStage()
    → validateTransition()
    → createTasksForNewStage()
    → createActivity()
    → emitEvent('deal:stage_changed')
    → notifySubscribers()
```

---

## V. Testing Strategy

### Unit Tests (80% target)
```typescript
// dealService.test.ts
describe('createDealService', () => {
  test('creates deal with payment schedule', async () => {
    const deal = await createDealService({...});
    expect(deal.id).toBeDefined();
    expect(deal.payments.length).toBeGreaterThan(0);
  });
  
  test('reserves unit', async () => {
    const deal = await createDealService({...});
    const unit = await getUnit(deal.unitId);
    expect(unit.status).toBe('RESERVED');
  });
  
  test('throws if unit unavailable', async () => {
    await expect(createDealService({unitId: 'taken'}))
      .rejects.toThrow('Unit not available');
  });
});
```

### Integration Tests
```typescript
// deal.integration.test.ts
describe('Complete Deal Workflow', () => {
  test('offer → deal → payment → stage advance', async () => {
    const offer = await createOffer({...});
    const deal = await acceptOffer(offer.id);
    await recordPayment(deal.id, {amount: 32900});
    const updated = await getDeal(deal.id);
    expect(updated.stage).toBe('RESERVATION_CONFIRMED');
  });
});
```

### E2E Tests (Critical Paths)
```typescript
// unit-matrix.cy.ts
describe('Unit Matrix', () => {
  it('filters units, creates offer, generates deal', () => {
    cy.visit('/units');
    cy.get('[data-testid=floor-filter]').select('1');
    cy.get('[data-testid=unit-cell][data-status=AVAILABLE]').first().click();
    cy.get('[data-testid=create-offer-btn]').click();
    cy.get('[data-testid=offer-price]').type('658000');
    cy.get('[data-testid=create-offer-submit]').click();
    cy.contains('Offer created successfully');
  });
});
```

---

## VI. Performance Budgets

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| FCP (First Contentful Paint) | <1s | TBD | Frontend |
| TTI (Time to Interactive) | <2.5s | TBD | Frontend |
| Largest Contentful Paint | <2.5s | TBD | Frontend |
| Cumulative Layout Shift | <0.1 | TBD | Frontend |
| API Response (p95) | <500ms | TBD | Backend |
| DB Query (p95) | <100ms | TBD | Backend |
| Memory (idle) | <50MB | TBD | Frontend |
| Bundle Size | <500KB gzipped | TBD | Frontend |

---

## VII. Database Optimization

### Indexes (Required for Launch)
```sql
CREATE INDEX idx_payments_dealId_status_dueDate ON payments(dealId, status, dueDate);
CREATE INDEX idx_deals_stage_createdAt ON deals(stage, createdAt);
CREATE INDEX idx_units_projectId_status ON units(projectId, status);
CREATE INDEX idx_leads_brokerAgentId ON leads(brokerAgentId);
CREATE INDEX idx_commissions_dealId_status ON commissions(dealId, status);
```

### Query Optimization
- Eager load relations in one query (not N+1)
- Paginate results (default 50, max 100)
- Use `select` to exclude unnecessary fields
- Cache payment plan templates (rarely change)

---

## VIII. Error Handling Strategy

### User-Facing Errors
```typescript
// Good: Clear message, actionable
{
  error: "Cannot move deal: 5% deposit not yet recorded",
  code: "INSUFFICIENT_PAYMENT",
  nextAction: "Record payment first",
  dealId: "..."
}

// Bad: Stack trace
{
  error: "Cannot read property 'stage' of undefined at validateTransition..."
}
```

### Logging Strategy
```typescript
// Critical: Log with context, no PII
logger.error('Deal stage transition failed', {
  dealId, currentStage, targetStage, error: err.message
});

// Never log: passwords, API keys, full objects with personal data
```

---

## IX. Deployment Checklist

### Pre-Launch (Week 5)
- [ ] All wireframes match designs 100%
- [ ] All 5 technical priorities implemented
- [ ] 80%+ test coverage
- [ ] No console errors/warnings in browser
- [ ] Database indexes created
- [ ] Environment variables documented
- [ ] Docker containers ready
- [ ] Staging mirror of production
- [ ] Backups configured
- [ ] Monitoring + alerting set up
- [ ] Rollback plan tested

### Launch Day
- [ ] Deploy to staging, verify
- [ ] Load test (100 concurrent users)
- [ ] Deploy to production during low-traffic window
- [ ] Monitor error rates (first 24h)
- [ ] Have rollback command ready

---

## X. Decision Log (Senior Architect)

### Week 1 Decisions
1. **Two-Column Deal Cockpit**: Right column sticky (not scrolling away). Rationale: Users need summary visible while reading timeline.
2. **Unit Matrix Grid**: 6-column responsive (not infinite scroll). Rationale: Users scan by floor, 40% better than table.
3. **Slide-Over Modals**: Keep parent context visible. Rationale: Users compare data, not just input.
4. **Real-time Socket.io**: Fallback to 60s polling. Rationale: Graceful degradation, resilient.
5. **PDF Service**: Async queue (email link when ready). Rationale: Don't timeout on requests, use event bus.

### Week 2+ Decisions (TBD)
- Commission tier strategy (flat vs tiered)
- Email digest frequency (daily vs real-time)
- Notification preferences (opt-in vs opt-out)

---

## XI. Team Responsibilities

### Frontend Architect (This Week)
- Unit Matrix Grid implementation
- Deal Cockpit two-column refactor
- Lead Offer modal
- Ensure responsive design
- Performance profiling + optimization

### Backend Architect (This Week)
- PDF generation service
- Task auto-generation
- Email service
- Socket.io setup
- Database indexing

### QA / Testing (Ongoing)
- Unit test coverage
- Integration test scenarios
- E2E critical paths
- Performance benchmarking
- Accessibility audit

### DevOps / Deployment (Week 5)
- Docker containers
- CI/CD pipeline
- Staging/Production setup
- Monitoring + alerting
- Backup strategy

---

## XII. Weekly Sync Points

**Every Monday 10am** (or async via PR review):
1. What's shipped (merged PRs)
2. What's blocked (PRs awaiting review)
3. What's next (upcoming tasks)
4. Architecture issues discovered
5. Performance/security concerns

**Every Friday 4pm**:
1. Week review (goals vs actual)
2. Early warning signs
3. Risk mitigation status
4. Next week priorities

---

This is the contract for the next 5 weeks. All decisions, code, and deployments follow these standards.

**Let's build a production-ready CRM. 🚀**
