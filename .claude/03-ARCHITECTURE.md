# 03 — Architecture & Tech Stack
**Samha Development CRM**

---

## Tech Stack (Final)

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React + Vite | React 18 | UI framework |
| Styling | Tailwind CSS | v3 | Responsive design |
| State (server) | TanStack Query | v5 | API data, caching, background refresh |
| State (UI) | Zustand | v4 | Drawer open/close, filters, selected items |
| Backend | Node.js + Express | Node 20 | API server |
| Database | PostgreSQL | v16 | Primary data store |
| ORM | Prisma | v5 | Type-safe DB queries + migrations |
| Auth | Clerk | latest | Login, roles, sessions |
| File Storage | Cloudflare R2 | — | Documents, floor plans |
| Email | Resend | — | Alerts, reminders, digest |
| WhatsApp | 360dialog API | — | Primary comms channel |
| Background Jobs | node-cron | — | Daily reminders, overdue checks |
| PDF | React-PDF | v3 | Sales offers, SPAs, schedules |
| E-sign | Documenso | self-hosted | SPA signatures |
| Hosting | Railway | — | App + DB, ~$20/month |

---

## Folder Structure

```
samha-crm/
├── apps/
│   ├── web/                          ← React frontend
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── units/
│   │   │   │   │   ├── UnitGrid.tsx
│   │   │   │   │   ├── UnitCard.tsx
│   │   │   │   │   ├── UnitDrawer.tsx
│   │   │   │   │   ├── UnitFilters.tsx
│   │   │   │   │   └── hooks/
│   │   │   │   │       └── useUnits.ts
│   │   │   │   ├── leads/
│   │   │   │   ├── deals/
│   │   │   │   ├── payments/
│   │   │   │   ├── brokers/
│   │   │   │   ├── documents/
│   │   │   │   ├── tasks/
│   │   │   │   └── reports/
│   │   │   ├── components/
│   │   │   │   └── ui/              ← shared buttons, modals, badges, tables
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           ← typed axios client
│   │   │   │   └── queryClient.ts
│   │   │   ├── stores/
│   │   │   │   └── uiStore.ts       ← Zustand for UI state
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   │
│   └── api/                          ← Node.js backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── unit/
│       │   │   │   ├── unit.routes.ts
│       │   │   │   ├── unit.controller.ts
│       │   │   │   ├── unit.service.ts     ← ALL unit logic here
│       │   │   │   └── unit.repository.ts
│       │   │   ├── lead/
│       │   │   ├── deal/
│       │   │   │   └── deal.service.ts     ← creates payment schedule
│       │   │   ├── payment/
│       │   │   │   └── payment.service.ts  ← mark paid, lock, audit
│       │   │   ├── broker/                 ← broker_companies + agents
│       │   │   ├── commission/
│       │   │   │   └── commission.service.ts ← unlock logic
│       │   │   ├── document/
│       │   │   │   └── document.service.ts  ← signed URLs
│       │   │   ├── task/
│       │   │   └── notification/
│       │   │
│       │   ├── events/
│       │   │   ├── eventBus.ts
│       │   │   └── handlers/
│       │   │       ├── onDealCreated.ts
│       │   │       ├── onDealStageChanged.ts
│       │   │       ├── onPaymentOverdue.ts
│       │   │       └── onOqoodRegistered.ts
│       │   │
│       │   ├── jobs/
│       │   │   ├── paymentReminder.job.ts
│       │   │   ├── overdueDetection.job.ts
│       │   │   ├── documentExpiry.job.ts
│       │   │   ├── oqoodDeadline.job.ts
│       │   │   └── dailyDigest.job.ts
│       │   │
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts      ← Clerk JWT verification
│       │   │   ├── rbac.middleware.ts      ← role-based per route
│       │   │   ├── validate.middleware.ts  ← Zod request validation
│       │   │   └── rateLimit.middleware.ts
│       │   │
│       │   ├── utils/
│       │   │   ├── signedUrl.ts           ← R2 signed URL generator
│       │   │   ├── pdfGenerator.ts
│       │   │   ├── whatsapp.ts
│       │   │   └── email.ts
│       │   │
│       │   └── app.ts
│       │
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
│
└── package.json
```

---

## Backend Patterns

### Route → Controller → Service → Repository

```
HTTP Request
    ↓
route.ts          (defines endpoint, attaches middleware)
    ↓
auth.middleware   (verifies Clerk JWT)
    ↓
rbac.middleware   (checks role has permission)
    ↓
validate.middleware (Zod schema check on body/params)
    ↓
controller.ts     (extracts req data, calls service, returns response)
    ↓
service.ts        (ALL business logic lives here)
    ↓
repository.ts     (Prisma queries — no logic, just data access)
    ↓
PostgreSQL
```

**Rule:** Controllers never touch Prisma directly. Services never import from routes. Business rules live only in services.

### Unit Status Service (Example)

```typescript
// unit.service.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE:  ['INTERESTED', 'RESERVED', 'BLOCKED'],
  INTERESTED: ['RESERVED', 'AVAILABLE'],
  RESERVED:   ['BOOKED', 'AVAILABLE', 'BLOCKED'],
  BOOKED:     ['SOLD', 'AVAILABLE', 'BLOCKED'],
  SOLD:       ['HANDED_OVER', 'BLOCKED'],
  HANDED_OVER: [],
  BLOCKED:    ['AVAILABLE'],
}

export async function changeUnitStatus(
  unitId: string,
  toStatus: string,
  changedBy: string,
  reason?: string,
  dealId?: string
) {
  const unit = await unitRepo.findById(unitId)
  const allowed = VALID_TRANSITIONS[unit.status]

  if (!allowed.includes(toStatus)) {
    throw new Error(`Cannot transition from ${unit.status} to ${toStatus}`)
  }

  await unitRepo.updateStatus(unitId, toStatus)
  await unitRepo.createStatusHistory({
    unitId, fromStatus: unit.status, toStatus, changedBy, reason, dealId
  })

  bus.emit('unit.statusChanged', { unitId, from: unit.status, to: toStatus })
}
```

---

## Event Bus

Simple Node.js EventEmitter — no infrastructure, no queue, no Kafka.

```typescript
// events/eventBus.ts
import EventEmitter from 'events'
export const bus = new EventEmitter()
bus.setMaxListeners(20)
```

### Events fired and their handlers

| Event | Fired When | Handler Does |
|---|---|---|
| `deal.created` | New deal saved | Generate payment schedule, lock unit to SOLD, create onboarding tasks |
| `deal.stageChanged` | Deal stage updated | Create auto-tasks, log activity, notify team |
| `deal.spaSignedAndOqoodRegistered` | Both conditions true | Unlock commission (→ PENDING_APPROVAL) |
| `deal.cancelled` | Deal cancelled | Return unit to AVAILABLE, forfeit commission, notify |
| `payment.overdue` | Daily job detects overdue | Send WhatsApp + email to buyer, create task for staff |
| `payment.received` | Payment marked paid | Log activity, check if all payments done → stage update |
| `oqood.deadline` | Daily job: X days remaining | Fire notification + email based on days left |
| `unit.statusChanged` | Any unit status change | Write status history, notify team |
| `document.uploaded` | New doc saved | Update deal document checklist status |
| `commission.unlocked` | SPA + Oqood both confirmed | Notify FINANCE role, create approval task |

---

## Background Jobs (node-cron)

All jobs run server-side on a schedule.

```typescript
// jobs/overdueDetection.job.ts
// Runs every day at 7:00 AM UAE time (UTC+4 = 03:00 UTC)

cron.schedule('0 3 * * *', async () => {
  const overduePayments = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: new Date() }
    },
    include: { deal: true }
  })

  for (const payment of overduePayments) {
    await paymentService.markOverdue(payment.id)
    bus.emit('payment.overdue', { paymentId: payment.id, dealId: payment.dealId })
  }
})
```

| Job | Schedule | What It Does |
|---|---|---|
| `overdueDetection` | Daily 7am UAE | Marks PENDING payments past due date as OVERDUE, fires alerts |
| `paymentReminder` | Daily 7am UAE | Finds payments due in 1, 3, 7 days, sends WhatsApp + email |
| `oqoodDeadline` | Daily 7am UAE | Finds deals with Oqood deadline in 1/7/15/30 days, fires alerts |
| `documentExpiry` | Weekly Monday 8am | Finds docs expiring in 30/60 days, sends alerts |
| `dailyDigest` | Daily 8am UAE | Emails each user their tasks due today + overdue items |

---

## API Design (REST)

```
# Projects
GET    /api/projects
POST   /api/projects

# Units
GET    /api/projects/:projectId/units          -- full unit grid data
GET    /api/units/:id                          -- unit detail + history
PATCH  /api/units/:id/status                   -- change status (service layer)
GET    /api/units/:id/interests                -- leads interested in this unit

# Leads
GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PATCH  /api/leads/:id
POST   /api/leads/:id/activities
GET    /api/leads/:id/activities

# Broker Companies
GET    /api/broker-companies
POST   /api/broker-companies
GET    /api/broker-companies/:id
GET    /api/broker-companies/:id/agents
POST   /api/broker-companies/:id/agents

# Deals
POST   /api/deals                              -- creates deal + payment schedule
GET    /api/deals/:id
PATCH  /api/deals/:id/stage                    -- stage change through service
GET    /api/deals/:id/payments
POST   /api/deals/:id/payments/:paymentId/mark-paid

# Payments
PATCH  /api/payments/:id/mark-paid
PATCH  /api/payments/:id/mark-pdc
GET    /api/payments/overdue                   -- all overdue across all deals

# Commissions
GET    /api/commissions/pending-approval
PATCH  /api/commissions/:id/approve
PATCH  /api/commissions/:id/mark-paid

# Documents
POST   /api/documents/upload                   -- get pre-signed R2 upload URL
POST   /api/documents                          -- save document record after upload
GET    /api/documents/:id/download             -- generate signed download URL
DELETE /api/documents/:id                      -- soft delete only

# Tasks
GET    /api/tasks/mine                         -- current user's tasks
POST   /api/tasks
PATCH  /api/tasks/:id/complete

# Reports
GET    /api/reports/overview                   -- executive summary
GET    /api/reports/payments                   -- collection report
GET    /api/reports/brokers                    -- broker performance
```

---

## Security

| Concern | Solution |
|---|---|
| Authentication | Clerk JWT verified on every request |
| Authorization | RBAC middleware per route (role → allowed operations) |
| Input validation | Zod schema on every POST/PATCH body |
| File access | Signed URLs (15-minute expiry) — never raw R2 URLs |
| File type validation | Server-side MIME check before saving to R2 |
| Rate limiting | express-rate-limit on all routes (100 req/min per IP) |
| Financial record integrity | Paid payments locked in service layer |
| Audit trail | payment_audit_log + unit_status_history for all changes |
| SQL injection | Prisma ORM (parameterized queries, no raw SQL) |

---

## Frontend State Management

```
Server data (deals, units, leads, payments)
  → TanStack Query (useQuery / useMutation)
  → automatic background refresh, optimistic updates

UI state (which drawer is open, active filters, selected unit)
  → Zustand store
  → never stores server data, only UI state

No Redux. No React Context for data.
```

---

## Deployment

```
GitHub repo
    ↓
Railway (auto-deploy on push to main)
    ├── Web service (React build served by Express)
    ├── API service (Node.js Express)
    └── PostgreSQL database

Cloudflare R2 (file storage — separate, always on)
Documenso (self-hosted on Railway — separate service)
```

Railway provides:
- HTTPS by default
- Environment variable management
- Automatic database backups
- One-click rollback
