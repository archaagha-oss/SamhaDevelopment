# Samha Development CRM — Complete App Specification
**Version:** 2.0 | **Date:** April 23, 2026 | **Status:** Phase 3 Complete

> **⚠ DUPLICATE — superseded by [`TECHNICAL-SPECIFICATION.md`](./TECHNICAL-SPECIFICATION.md).**
> The two docs cover the same scope; `TECHNICAL-SPECIFICATION.md` is the canonical
> source going forward. This file is kept for reference only and may be deleted
> after Phase 1 of `LAUNCH_READINESS_AUDIT.md` lands.

---

## TABLE OF CONTENTS
1. [App Overview](#app-overview)
2. [Core Business Logic](#core-business-logic)
3. [Full Database Schema (Prisma)](#database-schema)
4. [Complete API Endpoints](#api-endpoints)
5. [Frontend Screens & Layouts](#frontend-screens)
6. [Key Workflows (Step-by-Step)](#workflows)
7. [Real Estate Best Practices](#best-practices)
8. [User Roles & Permissions](#roles)

---

## APP OVERVIEW

### What This App Does
A unified web application where all property units, leads, deals, payments, contracts, and broker interactions for Samha Development live in one integrated system. Real-time deal pipeline tracking with automatic payment reminders, contract signature management, and broker commission workflows.

**Target Users:** 
- Sales agents (lead management, unit reservations)
- Operations staff (payment tracking, document management)
- Finance team (payment receipts, commission approvals)
- Project managers (pipeline overview, deadline tracking)
- Admin (system configuration, user management)

### Key Features
- ✅ Unit inventory with 7-status lifecycle (AVAILABLE → HANDED_OVER)
- ✅ Lead tracking with multi-unit interest support
- ✅ Deal creation with auto-calculated payment schedules
- ✅ Payment tracking (milestones, due dates, receipts, overdue detection)
- ✅ Broker company & agent management with commission workflows
- ✅ SPA (Sale & Purchase Agreement) e-signature management
- ✅ Oqood registration tracking with 90-day deadline enforcement
- ✅ Document management (passports, RERA cards, contracts, receipts)
- ✅ Activity logging (calls, WhatsApp, meetings, notes)
- ✅ Automatic notifications (WhatsApp, email, in-app)
- ✅ Task automation (overdue alerts, deadline reminders)
- ✅ Financial audit trails (immutable payment records, change logs)

---

## CORE BUSINESS LOGIC

### The Complete Sales Flow (10 Steps)

```
Lead Inquiry
    ↓
Step 1: CREATE LEAD
    • Broker agent calls/emails about unit
    • OR direct buyer inquiry
    • Create Lead record, assign to sales staff
    • Unit status → INTERESTED
    • Multiple leads can be INTERESTED in same unit
    ↓
Step 2: GENERATE SALES OFFER
    • Pre-fill PDF with unit specs, price, payment plan
    • Send via email/WhatsApp (logged as activity)
    • Lead status → OFFER_SENT
    ↓
Step 3: RESERVE UNIT (5% Booking Deposit)
    • Lead agrees to proceed
    • Unit status → RESERVED (only one lead can reserve)
    • Collect 5% non-refundable booking deposit
    • Log payment: method, amount, receipt
    • Generate Reservation Form PDF
    • Lead status → NEGOTIATING / RESERVATION_CONFIRMED
    ↓
Step 4: COLLECT BOOKING PAYMENT (15% + DLD + Admin)
    • Lead pays:
        - 15% of sale price
        - 4% DLD fee (auto-calculated from price)
        - AED 5,000 admin fee (fixed)
    • Log each payment separately with receipt
    • Unit status → BOOKED
    ↓
Step 5: CREATE DEAL
    • Once booking payments confirmed
    • Create Deal record: Lead + Unit + Broker Agent + Payment Plan
    • Auto-generate payment schedule (all future milestones)
    • Unit status → SOLD (locked from further reservations)
    • Create auto-tasks: "Send SPA", "Track Oqood"
    ↓
Step 6: SEND & SIGN SPA
    • Generate SPA PDF from deal data (pre-filled)
    • Send for e-signature via Documenso
    • Track status: PENDING → SENT → SIGNED
    • Upload signed SPA to deal documents
    • Deal stage → SPA_SIGNED
    ↓
Step 7: OQOOD REGISTRATION (★ Critical for Commission)
    • Initiate DLD Oqood registration after SPA signed
    • 90-day countdown starts from reservation date
    • Automatic alerts at: 30 days, 15 days, 7 days, 1 day remaining
    • Upload Oqood certificate when received
    • Deal stage → OQOOD_REGISTERED
    • ★ THIS UNLOCKS BROKER COMMISSION ★
    ↓
Step 8: COLLECT CONSTRUCTION INSTALLMENTS
    • Track payment schedule milestones
    • Automatic reminders: 7 days before, 3 days before, due date, 7 days overdue
    • WhatsApp + email sent to buyer & assigned staff
    • Each payment marked received with receipt
    • Track PDC (post-dated cheques) separately
    ↓
Step 9: FINAL HANDOVER
    • Collect final 70% payment
    • Unit handed over to buyer
    • Unit status → HANDED_OVER
    • Deal stage → COMPLETED
    • Mark all payments as CLEARED
    ↓
Step 10: BROKER COMMISSION PAYOUT
    • Commission ONLY payable when BOTH conditions met:
        1. SPA is signed (confirmed in system)
        2. Oqood is registered (confirmed in system)
    • Commission status unlocked → PENDING_APPROVAL
    • Admin reviews commission calculations
    • ADMIN approves → APPROVED
    • Payment to broker company recorded (external)
    • Commission status → PAID
    • If deal cancelled before Oqood: commission FORFEITED
```

### Unit Status Lifecycle

```
AVAILABLE
    │
    ├─→ INTERESTED (lead flags interest, can have multiple)
    │   ├─→ RESERVED (one lead pays 5% deposit)
    │   │   ├─→ BOOKED (15% + DLD + admin paid)
    │   │   │   └─→ SOLD (deal created)
    │   │   │       └─→ HANDED_OVER (final payment + handover)
    │   │   │
    │   │   └─→ AVAILABLE (lead cancels before booking payment)
    │   │
    │   └─→ AVAILABLE (lead withdraws interest)
    │
    └─→ BLOCKED (ADMIN only, with reason)
        └─→ AVAILABLE (ADMIN unblocks)
```

### Payment Rules (Locked & Immutable)

| Rule | Detail |
|------|--------|
| **Amount Locked** | Calculated at deal creation, cannot change without ADMIN override (creates audit log) |
| **PAID = Immutable** | Once marked PAID, record cannot be edited — corrections via WAIVED entry only |
| **Overdue Detection** | Daily job marks PENDING payments past due date as OVERDUE, triggers alerts |
| **PDC Workflow** | POST_DATED_CHEQUE → PDC_PENDING → PDC_CLEARED (or PDC_BOUNCED) |
| **DLD Fee** | Always 4% of sale price, calculated and locked at deal creation |
| **Admin Fee** | Always AED 5,000 fixed per deal |
| **Audit Trail** | Every change logged in payment_audit_log with action, old/new values, reason |

### Commission Rules (SPA + Oqood Gate)

```
Commission Status Flow:
    NOT_DUE
        ↓ (when SPA signed AND Oqood registered)
    PENDING_APPROVAL
        ↓ (ADMIN reviews & approves)
    APPROVED
        ↓ (payment processed externally)
    PAID
        
OR → FORFEITED (if deal cancelled before Oqood registered)
```

**Unlock Conditions (Enforced in System):**
- `deal.spaSignedDate IS NOT NULL`
- `deal.oqoodRegisteredDate IS NOT NULL`
- `deal.stage = 'OQOOD_REGISTERED'`
- Commission can only move to PENDING_APPROVAL when ALL three conditions are true

---

## DATABASE SCHEMA

### Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

model Project {
  id                String   @id @default(uuid())
  name              String   @unique
  location          String
  totalUnits        Int
  reraPermitNumber  String?
  escrowAccount     String?
  constructionStart DateTime?
  handoverDate      DateTime?
  status            String   @default("ACTIVE")  // PRESALE | ACTIVE | COMPLETED
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  units        Unit[]
  leads        Lead[]
  deals        Deal[]
  paymentPlans PaymentPlan[]

  @@map("projects")
}

model Unit {
  id              String   @id @default(uuid())
  projectId       String
  unitNumber      String   // "301", "A-1204", "RETAIL-1"
  floor           Int
  type            String   // STUDIO | 1BR | 2BR | 3BR | PENTHOUSE | COMMERCIAL
  area            Float    // sqm
  bathrooms       Int?
  parkingSpaces   Int?
  internalArea    Float?   // suite area sqm
  externalArea    Float?   // balcony area sqm
  basePrice       Float?   // original price (immutable)
  price           Float    // current asking price
  view            String   // SEA | GARDEN | CITY | POOL | STREET | NONE
  status          String   @default("AVAILABLE")  // lifecycle enum
  blockReason     String?  // required if BLOCKED
  blockExpiresAt  DateTime?
  internalNotes   String?  @db.Text
  tags            Json?    // ["corner", "premium"]
  floorPlanKey    String?  // R2 storage
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project       Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  statusHistory UnitStatusHistory[]
  interests     LeadUnitInterest[]
  deal          Deal?
  documents     Document[]
  images        Document[]         // via Document type=FLOOR_PLAN

  @@unique([projectId, unitNumber])
  @@index([projectId])
  @@index([status])
  @@index([type])
  @@index([view])
  @@map("units")
}

model UnitStatusHistory {
  id         String   @id @default(uuid())
  unitId     String
  fromStatus String
  toStatus   String
  changedBy  String   // user ID
  reason     String?
  dealId     String?
  createdAt  DateTime @default(now())

  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@index([unitId])
  @@map("unit_status_history")
}

// ============================================================================
// LEADS & BROKER MANAGEMENT
// ============================================================================

model Lead {
  id            String   @id @default(uuid())
  projectId     String
  firstName     String
  lastName      String
  email         String?
  phone         String   @unique
  nationality   String?
  source        String   // BROKER | DIRECT | WALK_IN | REFERRAL | PORTAL | SOCIAL | OTHER
  brokerAgentId String?
  assignedTo    String   // user ID
  budget        Decimal? @db.Decimal(14,2)
  status        String   @default("NEW")
          // NEW | CONTACTED | OFFER_SENT | SITE_VISIT | NEGOTIATING | CONVERTED | LOST | DORMANT
  lostReason    String?
  notes         String?  @db.Text
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  brokerAgent BrokerAgent?     @relation(fields: [brokerAgentId], references: [id])
  assignedUser User            @relation("LeadAssignedTo", fields: [assignedTo], references: [id])
  interests   LeadUnitInterest[]
  deals       Deal[]
  activities  Activity[]
  documents   Document[]
  tasks       Task[]

  @@index([status, assignedTo, projectId])
  @@index([phone])
  @@map("leads")
}

model LeadUnitInterest {
  id        String   @id @default(uuid())
  leadId    String
  unitId    String
  isPrimary Boolean  @default(false)
  notes     String?
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([leadId, unitId])
  @@map("lead_unit_interests")
}

model BrokerCompany {
  id                   String   @id @default(uuid())
  companyName          String
  tradeLicenseNumber   String?
  reraLicenseNumber    String?
  reraLicenseExpiry    DateTime?
  email                String?
  phone                String?
  address              String?  @db.Text
  commissionRate       Decimal  @default(4.00) @db.Decimal(5,2)  // percentage
  status               String   @default("ACTIVE")  // ACTIVE | INACTIVE | BLOCKED
  notes                String?  @db.Text
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  agents      BrokerAgent[]
  commissions Commission[]
  documents   Document[]

  @@map("broker_companies")
}

model BrokerAgent {
  id              String   @id @default(uuid())
  brokerCompanyId String
  firstName       String
  lastName        String
  email           String?
  phone           String
  reraCardNumber  String?
  reraCardExpiry  DateTime?
  status          String   @default("ACTIVE")  // ACTIVE | INACTIVE
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  brokerCompany BrokerCompany @relation(fields: [brokerCompanyId], references: [id], onDelete: Cascade)
  leads         Lead[]
  deals         Deal[]
  commissions   Commission[]
  documents     Document[]

  @@map("broker_agents")
}

// ============================================================================
// DEALS & PAYMENTS
// ============================================================================

model Deal {
  id                      String   @id @default(uuid())
  projectId               String
  unitId                  String   @unique
  leadId                  String
  brokerAgentId           String?
  paymentPlanId           String
  assignedTo              String   // user ID
  
  // Financials (locked at creation)
  salePrice               Decimal  @db.Decimal(14,2)
  discountAmount          Decimal  @default(0) @db.Decimal(14,2)
  discountReason          String?
  dldFeeAmount            Decimal  @db.Decimal(14,2)  // 4% of salePrice
  adminFeeAmount          Decimal  @default(5000) @db.Decimal(14,2)  // fixed
  brokerCommissionAmount  Decimal? @db.Decimal(14,2)  // locked at creation
  
  // Stages
  stage                   String   @default("RESERVATION_PENDING")
            // RESERVATION_PENDING | RESERVATION_CONFIRMED | SPA_PENDING | SPA_SENT
            // | SPA_SIGNED | OQOOD_PENDING | OQOOD_REGISTERED
            // | INSTALLMENTS_ACTIVE | HANDOVER_PENDING | COMPLETED | CANCELLED
  
  // Key dates
  reservationDate         DateTime
  spaSentDate             DateTime?
  spaSignedDate           DateTime?
  oqoodRegisteredDate     DateTime?
  handoverDate            DateTime?
  oqoodDeadline           DateTime  // = reservationDate + 90 days (auto-calculated)
  
  // Commission state (SPA + Oqood gate)
  commissionStatus        String   @default("NOT_DUE")
            // NOT_DUE | PENDING_APPROVAL | APPROVED | PAID | FORFEITED
  
  // Cancellation
  cancelledReason         String?
  cancelledBy             String?  // user ID
  cancelledAt             DateTime?
  
  notes                   String?  @db.Text
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit         Unit         @relation(fields: [unitId], references: [id], onDelete: Cascade)
  lead         Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  brokerAgent  BrokerAgent? @relation(fields: [brokerAgentId], references: [id], onDelete: SetNull)
  paymentPlan  PaymentPlan  @relation(fields: [paymentPlanId], references: [id])
  assignedUser User         @relation("DealAssignedTo", fields: [assignedTo], references: [id])
  payments     Payment[]
  documents    Document[]
  tasks        Task[]
  activities   Activity[]
  commission   Commission?

  @@index([stage, projectId])
  @@index([assignedTo, stage])
  @@map("deals")
}

model PaymentPlan {
  id          String   @id @default(uuid())
  projectId   String
  name        String   // "30/70 Standard", "40/60 Cash Discount"
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project    Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  milestones PaymentPlanMilestone[]
  deals      Deal[]

  @@map("payment_plans")
}

model PaymentPlanMilestone {
  id                 String   @id @default(uuid())
  paymentPlanId      String
  label              String   // "Booking Deposit", "Handover Payment"
  percentage         Decimal  @db.Decimal(5,2)  // 5.00, 15.00, 70.00
  triggerType        String
            // ON_BOOKING | ON_DATE | DAYS_AFTER_PREVIOUS | ON_CONSTRUCTION_STAGE | ON_HANDOVER
  triggerDate        DateTime?      // for ON_DATE
  constructionStage  String?        // for ON_CONSTRUCTION_STAGE
  daysAfterPrevious  Int?          // for DAYS_AFTER_PREVIOUS
  sortOrder          Int
  isDLDFee           Boolean  @default(false)   // marks 4% DLD
  isAdminFee         Boolean  @default(false)   // marks AED 5,000 admin
  createdAt          DateTime @default(now())

  paymentPlan PaymentPlan @relation(fields: [paymentPlanId], references: [id], onDelete: Cascade)
  payments    Payment[]

  @@map("payment_plan_milestones")
}

model Payment {
  id            String   @id @default(uuid())
  dealId        String
  milestoneId   String
  label         String   // copied from milestone at deal creation
  amount        Decimal  @db.Decimal(14,2)  // locked at creation
  dueDate       DateTime
  paidDate      DateTime?
  status        String   @default("PENDING")
            // PENDING | PAID | OVERDUE | WAIVED | PDC_PENDING | PDC_CLEARED | PDC_BOUNCED
  paymentMethod String?  // BANK_TRANSFER | CHEQUE | CASH | PDC | ONLINE
  receiptKey    String?  // R2 file key (never raw URL)
  chequeNumber  String?
  bankName      String?
  chequeDate    DateTime?  // for PDC
  paidBy        String?   // user ID
  notes         String?
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  deal      Deal                 @relation(fields: [dealId], references: [id], onDelete: Cascade)
  milestone PaymentPlanMilestone @relation(fields: [milestoneId], references: [id])
  auditLog  PaymentAuditLog[]

  @@index([dealId, status, dueDate])
  @@map("payments")
}

model PaymentAuditLog {
  id        String   @id @default(uuid())
  paymentId String
  userId    String   // who made the change
  action    String   // CREATED | MARKED_PAID | WAIVED | PDC_CLEARED | PDC_BOUNCED | ADMIN_OVERRIDE
  oldValues Json?    // snapshot of changed fields
  newValues Json?    // snapshot after
  reason    String?  // why was it changed
  createdAt DateTime @default(now())

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@map("payment_audit_log")
}

model Commission {
  id                String   @id @default(uuid())
  dealId            String   @unique
  brokerCompanyId   String
  brokerAgentId     String?  // FYI only
  amount            Decimal  @db.Decimal(14,2)  // locked at creation
  status            String   @default("NOT_DUE")
            // NOT_DUE | PENDING_APPROVAL | APPROVED | PAID | FORFEITED
  approvedBy        String?  // user ID
  approvedAt        DateTime?
  paidAt            DateTime?
  paymentReference  String?  // external payment ref
  documentKey       String?  // R2 key for Form A or proof
  notes             String?  @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  deal          Deal          @relation(fields: [dealId], references: [id], onDelete: Cascade)
  brokerCompany BrokerCompany @relation(fields: [brokerCompanyId], references: [id])
  brokerAgent   BrokerAgent?  @relation(fields: [brokerAgentId], references: [id], onDelete: SetNull)

  @@map("commissions")
}

// ============================================================================
// DOCUMENTS & AUDIT
// ============================================================================

model Document {
  id          String   @id @default(uuid())
  entityType  String   // DEAL | LEAD | BROKER_COMPANY | BROKER_AGENT | UNIT
  entityId    String
  type        String
            // PASSPORT | EMIRATES_ID | VISA
            // SALES_OFFER | RESERVATION_FORM
            // SPA | SIGNED_SPA
            // OQOOD_CERTIFICATE
            // PAYMENT_RECEIPT
            // BROKER_LICENSE | BROKER_RERA_CARD | FORM_A
            // FLOOR_PLAN | BROCHURE | OTHER
  fileKey     String   // R2 path
  fileName    String   // original name
  fileSize    Int?
  mimeType    String?
  version     Int      @default(1)
  uploadedBy  String   // user ID
  expiryDate  DateTime?  // for passports, RERA cards, licenses
  status      String   @default("RECEIVED")  // PENDING | RECEIVED | EXPIRED | REJECTED
  isDeleted   Boolean  @default(false)
  deletedBy   String?  // user ID
  notes       String?  @db.Text
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([expiryDate])  // for expiry alert jobs
  @@map("documents")
}

model Activity {
  id                String   @id @default(uuid())
  entityType        String   // LEAD | DEAL | BROKER_COMPANY | BROKER_AGENT
  entityId          String
  userId            String   // who logged it
  type              String
            // CALL | WHATSAPP | EMAIL | MEETING | NOTE | SITE_VISIT
            // STAGE_CHANGE | DOCUMENT_UPLOADED | PAYMENT_RECEIVED | TASK_COMPLETED
  summary           String
  outcome           String?
  nextFollowUpDate  DateTime?
  
  // Structured fields by type
  callDuration      Int?      // seconds
  whatsappMessageId String?   // from 360dialog
  meetingLocation   String?
  previousStage     String?   // for STAGE_CHANGE
  newStage          String?   // for STAGE_CHANGE
  
  createdAt         DateTime @default(now())

  @@index([entityType, entityId])
  @@map("activities")
}

model Task {
  id              String   @id @default(uuid())
  assignedTo      String   // user ID
  createdBy       String   // user ID
  entityType      String   // LEAD | DEAL | BROKER_COMPANY
  entityId        String
  title           String
  description     String?  @db.Text
  dueDate         DateTime
  priority        String   @default("MEDIUM")  // LOW | MEDIUM | HIGH | URGENT
  status          String   @default("OPEN")  // OPEN | IN_PROGRESS | DONE | CANCELLED
  isAutoGenerated Boolean  @default(false)   // true if fired by event system
  reminderSentAt  DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([assignedTo, status, dueDate])
  @@map("tasks")
}

model Notification {
  id          String   @id @default(uuid())
  userId      String
  type        String
            // PAYMENT_DUE | PAYMENT_OVERDUE | OQOOD_DEADLINE | DOCUMENT_EXPIRY
            // TASK_DUE | STAGE_CHANGED | NEW_LEAD | UNIT_RESERVED | COMMISSION_READY
  title       String
  message     String
  isRead      Boolean  @default(false)
  entityType  String?
  entityId    String?
  createdAt   DateTime @default(now())

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique
  name      String
  email     String   @unique
  phone     String?
  role      String   @default("SALES")  // ADMIN | SALES | OPERATIONS | FINANCE | READONLY
  isActive  Boolean  @default(true)
  lastLogin DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignedLeads Lead[] @relation("LeadAssignedTo")
  assignedDeals Deal[] @relation("DealAssignedTo")

  @@map("users")
}
```

---

## API ENDPOINTS

### Authentication & Base
```
GET  /health                          # Health check
BASE: http://localhost:3000
AUTH: Clerk JWT (Bearer token) for protected routes
```

### Projects
```
GET    /api/projects                  # List all projects
POST   /api/projects                  # Create project (ADMIN only)
GET    /api/projects/:id              # Get project with units
GET    /api/projects/:id/stats        # Project statistics
```

### Units
```
GET    /api/projects/:projectId/units # List units with filters
  ?status=AVAILABLE&type=2BR&floor=5&view=SEA

GET    /api/units/:id                 # Get unit detail + history
PATCH  /api/units/:id/status          # Change unit status (service layer enforces rules)
  Body: { "newStatus": "INTERESTED", "reason": "..." }

GET    /api/units/:id/interests       # Get leads interested in unit
```

### Leads
```
GET    /api/leads                     # List all leads
  ?status=NEW&assignedTo=user123&projectId=proj123

POST   /api/leads                     # Create lead
  Body: { firstName, lastName, phone, email?, source, budget?, brokerAgentId? }

GET    /api/leads/:id                 # Get lead detail
PATCH  /api/leads/:id                 # Update lead
  Body: { status, lostReason?, notes?, assignedTo? }

GET    /api/leads/:id/activities      # Get lead activity log
POST   /api/leads/:id/activities      # Log activity (call, WhatsApp, email, note, meeting)
  Body: { type, summary, outcome?, nextFollowUpDate?, callDuration?, location? }

GET    /api/leads/:id/interests       # Get units lead is interested in
```

### Broker Companies & Agents
```
GET    /api/broker-companies          # List all broker companies
POST   /api/broker-companies          # Create broker company (ADMIN)
GET    /api/broker-companies/:id      # Get company detail
GET    /api/broker-companies/:id/agents  # Get agents for company
POST   /api/broker-companies/:id/agents  # Add agent to company

PATCH  /api/broker-agents/:id         # Update agent (status, RERA card expiry, etc)
```

### Deals
```
POST   /api/deals                     # Create deal (from lead)
  Body: {
    leadId, unitId, projectId, paymentPlanId,
    salePrice, discountAmount?, brokerAgentId?, assignedTo
  }
  → Returns: Deal with auto-generated payment schedule

GET    /api/deals/:id                 # Get deal detail
PATCH  /api/deals/:id/stage           # Update deal stage
  Body: { newStage, reason? }

GET    /api/deals/:id/payments        # Get all payments for deal
GET    /api/deals/pipeline            # Get all deals grouped by stage
```

### Payments
```
GET    /api/payments/overdue          # Get all overdue payments across deals
PATCH  /api/payments/:id/mark-paid    # Mark payment as received
  Body: { paidDate, paymentMethod, receiptKey?, chequeNumber?, notes? }

PATCH  /api/payments/:id/mark-pdc     # Mark as PDC
  Body: { chequeNumber, chequeDate, bankName, notes? }

GET    /api/payments/:id/audit        # Get audit log for payment
```

### Commissions
```
GET    /api/commissions               # Get all commissions
GET    /api/commissions/pending-approval  # Get commissions ready for approval
PATCH  /api/commissions/:id/approve   # FINANCE/ADMIN approves commission
  Body: { approvedReason? }

PATCH  /api/commissions/:id/mark-paid # Mark commission as paid
  Body: { paymentReference, documentKey?, notes? }
```

### Documents
```
POST   /api/documents/upload          # Get pre-signed R2 upload URL
  Body: { entityType, entityId, type, fileName }
  → Returns: { uploadUrl, fileKey }

POST   /api/documents                 # Save document record after upload
  Body: { entityType, entityId, type, fileKey, fileName, expiryDate? }

GET    /api/documents/:id/download    # Generate signed download URL
DELETE /api/documents/:id             # Soft delete (isDeleted flag)
```

### Tasks
```
GET    /api/tasks/mine                # Current user's tasks
  ?status=OPEN&dueDate=2026-04-25

POST   /api/tasks                     # Create task
  Body: { title, description, dueDate, priority, entityType, entityId, assignedTo }

PATCH  /api/tasks/:id/complete        # Mark task complete
PATCH  /api/tasks/:id                 # Update task
```

### Reports & Analytics
```
GET    /api/reports/overview          # Executive dashboard
  → { totalUnits, byStatus, totalRevenue, activeDeals, overduepayments }

GET    /api/reports/payments          # Payment collection report
  → { totalExpected, totalReceived, byStatus, byPaymentMethod }

GET    /api/reports/brokers           # Broker performance report
  → { dealsPerBroker, commissionsPending, commissionsApproved }

GET    /api/reports/pipeline          # Sales pipeline report
  → { leadsByStatus, conversionRate, avgDaysToClose }
```

### Users
```
GET    /api/users                     # List all users
POST   /api/users                     # Create user (ADMIN only)
PATCH  /api/users/:id                 # Update user (role, isActive)
GET    /api/me                        # Current authenticated user
```

---

## FRONTEND SCREENS

### Page Structure

```
App
├── AuthGuard (Clerk)
│
├── Dashboard (/)
│   └── Project selector, key metrics, shortcuts
│
├── Projects (/projects)
│   ├── ProjectsPage (list all projects)
│   └── ProjectDetailPage (/projects/:id)
│       └── Unit grid with filters & statuses
│
├── Units (/units)
│   └── UnitDetailPage (/units/:id)
│       ├── Unit specs, price, floor plan
│       ├── Interests (leads)
│       ├── Deal history
│       └── Documents
│
├── Leads (/leads)
│   ├── LeadsPage (list)
│   │   └── Filters: status, assignedTo, source
│   └── LeadProfilePage (/leads/:id)
│       ├── Lead details & interests
│       ├── Activity timeline (calls, WhatsApp, meetings, notes)
│       ├── Documents (passport, ID, visa)
│       ├── Tasks assigned
│       └── Create Deal (drawer)
│
├── Deals (/deals)
│   ├── DealsPage (pipeline view)
│   │   └── Kanban: RESERVATION_PENDING → COMPLETED
│   └── DealDetailPage (/deals/:id)
│       ├── Unit + Lead + Broker info
│       ├── Payment schedule (milestones)
│       ├── Payment tracking (paid/pending/overdue)
│       ├── Documents (SPA, Oqood cert, receipts)
│       ├── Commission status (locked until SPA + Oqood)
│       ├── Oqood countdown (90 days from reservation)
│       ├── Activity timeline
│       └── Task list
│
├── Payments (/payments)
│   ├── PaymentReportPage
│   │   └── All payments across all deals
│   │   └── Filters: status, dueDate, method
│   └── Overdue alerts widget
│
├── Brokers (/brokers)
│   ├── BrokerPage (list companies & agents)
│   ├── Commission dashboard
│   │   └── Pending approval, approved, paid
│   └── Broker performance analytics
│
├── Reports (/reports)
│   ├── Overview dashboard (metrics)
│   ├── Pipeline report (leads by status)
│   ├── Collection report (payment status)
│   └── Broker report (performance)
│
└── Settings (/settings) [ADMIN only]
    ├── Users management
    ├── Payment plans
    ├── Project management
    └── System configuration
```

### Key Screen Details

#### 1. Projects Page
- List all projects
- Grid/list view toggle
- Each project card: name, location, total units, sold count
- Quick stats: available, sold, reserved, booked

#### 2. Unit Grid (Project Detail)
- Responsive grid of units
- Each unit card: unit number, type, floor, area, price, status badge
- Interactive filters:
  - Status (AVAILABLE, INTERESTED, RESERVED, BOOKED, SOLD, BLOCKED, HANDED_OVER)
  - Type (STUDIO, 1BR, 2BR, 3BR, PENTHOUSE, COMMERCIAL)
  - View (SEA, GARDEN, CITY, POOL, STREET)
  - Floor range
  - Price range
- Click unit → opens Unit Detail drawer
- Right-click context menu: update status, block, view history

#### 3. Unit Detail Drawer/Page
- **Top Section:**
  - Unit number, floor, type, view
  - Area (sqm), bathrooms, parking
  - Base price, current price, discount history
- **Status Section:**
  - Current status with change history
  - Change status button (service layer validates transitions)
  - Block reason if blocked
  - Block expiry date
- **Interested Leads:**
  - List of leads interested in unit
  - Which lead reserved (if any)
  - Mark as primary interest option
- **Deal Information** (if sold):
  - Deal ID, lead name, broker info
  - Payment status, handover status
- **Documents:**
  - Floor plan, brochure, images
- **Activity:**
  - Status change history with timestamps

#### 4. Leads Page
- List all leads in table/card view
- Each lead: name, phone, source, assigned agent, status, budget
- Filters: status, assignedTo, source, project, budget range
- Actions: view profile, assign, change status, mark lost
- New Lead button → form

#### 5. Lead Profile Page
- **Lead Information:**
  - Name, phone, email, nationality
  - Source (BROKER/DIRECT/etc)
  - Budget, status, assigned to
  - Broker agent (if broker-sourced)
- **Unit Interests:**
  - List of units interested in
  - Mark primary interest
  - View unit details
- **Activity Timeline:**
  - Chronological: calls, WhatsApp, emails, meetings, notes
  - Filter by type
  - Log new activity button
  - Next follow-up date tracking
- **Documents:**
  - Passport, Emirates ID, visa
  - Upload new documents
  - Expiry tracking with alerts
- **Tasks:**
  - Assigned tasks for this lead
  - Create task button
- **Create Deal Button:**
  - Opens drawer with lead → unit → deal creation flow
  - Pre-fills lead & broker agent
  - Select unit to sell
  - Select payment plan
  - Enter sale price & discount
  - Auto-calculate DLD & admin fees
  - Review & confirm

#### 6. Deal Detail Page
- **Deal Header:**
  - Lead name + unit info + broker info
  - Sale price (locked) + discount
  - DLD fee + admin fee (both locked)
  - Broker commission status (locked until SPA + Oqood)
- **Timeline Section:**
  - Reservation date
  - SPA sent date → signed date
  - Oqood deadline (90 days from reservation) with **COUNTDOWN TIMER**
  - Oqood registered date
  - Handover date
  - Visual timeline showing progress
- **Payment Schedule:**
  - Table of all milestones
  - Columns: label, percentage, amount, due date, status, payment method, receipt
  - Color-coded status: PENDING (gray), OVERDUE (red), PAID (green), PDC_PENDING (yellow)
  - Mark paid button per row
  - PDC tracking: cheque number, cheque date, status
- **Commission Section:**
  - Current status (locked until SPA + Oqood registered)
  - Amount (locked at creation)
  - Approval workflow:
    - NOT_DUE → (once SPA + Oqood both done) → PENDING_APPROVAL → (ADMIN approves) → APPROVED → (payment processed) → PAID
  - Show unlock conditions: "Waiting for SPA signature" or "Waiting for Oqood registration"
  - Once PENDING_APPROVAL: show "Ready for FINANCE review" button
- **Documents Section:**
  - SPA (PENDING → SENT → SIGNED)
  - Oqood certificate
  - Payment receipts
  - Upload/download buttons
  - Signature status tracker
- **Activity Section:**
  - Log of all deal events: stage changes, payments, document uploads
  - Filter by type
- **Tasks Section:**
  - Auto-generated and manual tasks
  - Create task button
  - Mark done button

#### 7. Payment Report Page
- Table of all payments across all deals
- Columns: deal ID, lead name, unit, amount, due date, paid date, status, method, receipt
- Filters: status, dueDate range, paymentMethod, dealId
- Overdue payments highlighted in red with alert icon
- Actions: view receipt, download receipt, mark paid
- Summary stats: total expected, total received, overdue amount, this month collected

#### 8. Broker Page
- **Broker Companies List:**
  - Table: company name, agents count, RERA license, expiry, commission rate
  - Actions: view, edit, add agent
- **Broker Agents:**
  - Sub-table per company
  - Columns: agent name, email, phone, RERA card, expiry, status
  - Actions: view, edit
- **Commission Dashboard:**
  - Pending approval (count + list)
  - Approved (count + list)
  - Paid (count + list)
  - Forfeited (count + list)
  - Each commission row: broker company, deal, amount, due date, status, approve/pay buttons

#### 9. Dashboard / Overview
- **Key Metrics:**
  - Total units (available, sold, reserved, booked, blocked)
  - Total leads (new, converted, lost)
  - Total deal value (all deals)
  - Total received payments
  - Overdue payments amount & count
- **Alerts Widget:**
  - Oqood deadlines (7 days, 15 days, 30 days)
  - Overdue payments
  - Unsigned SPAs
  - Expiring documents
  - Pending commissions
- **Pipeline Kanban:**
  - Drag-and-drop deal columns: RESERVATION_PENDING → COMPLETED
  - Card: unit + lead + status + payment progress bar
- **Recent Activity:**
  - Latest deals created, payments received, documents uploaded
- **Today's Tasks:**
  - Current user's tasks due today
  - Overdue tasks

#### 10. Task Management
- Sidebar task panel or dedicated page
- Show: assigned to me, due today/overdue, by priority
- Mark done / snooze / reassign / delete
- Auto-generated tasks vs manual
- Can be filtered by: status, priority, dueDate, entityType

#### 11. Reports Section
- **Overview Report:** KPIs, metrics, trends
- **Pipeline Report:** leads by status, conversion rate, days to close
- **Collection Report:** payment status, method breakdown, days overdue
- **Broker Report:** deals per broker, commissions pending/approved/paid

#### 12. Settings (Admin Only)
- **Users Management:** add, edit, remove, assign roles
- **Payment Plans:** create, edit, view milestones
- **Projects:** create, edit, view units
- **System Configuration:** business rules, alert thresholds

---

## KEY WORKFLOWS

### Workflow 1: Lead Inquiry to Offer (2-4 hours)

1. **Receive Inquiry**
   - Broker agent calls or emails sales staff
   - Staff member opens app → Leads → Create Lead
2. **Create Lead Record**
   - Fill form: First name, last name, phone, email (opt), nationality, budget, source
   - If broker-sourced: select broker company → broker agent
   - Save → lead.status = NEW
3. **Review Units & Mark Interest**
   - Leads → [lead] → Unit Interests → Add Units
   - Select 1-3 units customer is interested in
   - Unit status changes to INTERESTED (multiple leads can be interested)
4. **Generate Sales Offer PDF**
   - Select unit from interests
   - Click "Generate Sales Offer"
   - System pre-fills: unit specs, price, payment plan summary, DLD calculation
   - Download or send via email/WhatsApp
   - Log activity: EMAIL or WHATSAPP type, timestamp
   - Lead status → OFFER_SENT

**Checkpoints:**
- Lead created with correct source assignment
- Unit status shows INTERESTED
- Activity logged for email/WhatsApp send

---

### Workflow 2: Reservation & Booking Payment (24-48 hours)

1. **Receive Confirmation**
   - Lead confirms interest via call/WhatsApp
   - Sales staff notes in activity log
2. **Reserve Unit**
   - Lead → unit interests → click "Reserve Unit"
   - System validates: unit is AVAILABLE or INTERESTED
   - Change unit status to RESERVED (only one lead can reserve)
   - Lead status → NEGOTIATING or RESERVATION_CONFIRMED
   - Activity log: status change + "5% deposit confirmed"
3. **Collect 5% Deposit**
   - Create task: "Collect 5% deposit from [lead]"
   - Lead pays 5% (non-refundable)
   - Staff member marks payment received:
     - In app: Leads → [lead] → [unit] → Log Payment
     - Amount = 5% of unit price
     - Payment method (bank transfer, cheque, cash)
     - Receipt uploaded (R2 signed URL)
   - Status → PAID
4. **Generate Reservation Form**
   - System generates PDF: lead details + unit + 5% amount + dates
   - Send via email/WhatsApp
   - Log activity
5. **Collect Booking Payment (15% + DLD + Admin)**
   - Lead pays:
     - 15% of unit price
     - 4% DLD fee (= unit price × 0.04)
     - AED 5,000 admin fee (fixed)
   - Staff marks each payment separately (3 separate payment records)
   - Unit status → BOOKED
   - Lead status → CONVERTED
6. **Create Deal**
   - Navigate to lead → click "Create Deal"
   - Form pre-filled: lead, unit, broker agent (if applicable)
   - Enter: sale price, discount amount (if any), select payment plan
   - System auto-calculates: DLD fee (4% of sale price), admin fee (5,000 AED), broker commission (if broker-sourced)
   - Review & confirm
   - Deal created → deal.stage = RESERVATION_PENDING
   - **System Auto-Actions:**
     - Generate payment schedule based on payment plan
     - Create tasks: "Send SPA to buyer", "Collect remaining payments"
     - Mark unit as SOLD
     - Notify operations: SPA needs to be sent
     - Notify finance: commission will be pending

**Checkpoints:**
- Unit status: INTERESTED → RESERVED → BOOKED → SOLD
- Lead status: NEW → OFFER_SENT → NEGOTIATING → CONVERTED
- All 5% + 15% + DLD + admin payments marked as PAID
- Deal created with correct payment plan
- Payment schedule auto-generated

---

### Workflow 3: SPA Signing & Oqood Registration (7-30 days)

1. **Send SPA for Signature**
   - Deal detail page → Documents section → click "Send SPA"
   - System generates SPA PDF pre-filled with: buyer name, unit details, price, payment schedule
   - Send to Documenso for e-signature
   - Track status: PENDING → SENT
   - Log activity: "SPA sent for signature"
   - Deal stage → SPA_SENT
   - Create auto-task: "Follow up SPA signature"

2. **Buyer Signs SPA**
   - Buyer receives e-signature link via email
   - Signs document in Documenso
   - Signed SPA downloaded automatically
   - Staff uploads signed document to deal
   - Document status = SIGNED_SPA
   - Deal stage → SPA_SIGNED
   - Log activity: "SPA signed"
   - Create auto-task: "Submit Oqood registration"

3. **Submit Oqood Registration**
   - Operations staff initiates DLD Oqood registration
   - System auto-calculates: Oqood deadline = reservation date + 90 days
   - Store deadline in deal.oqoodDeadline
   - System starts countdown alerts:
     - 30 days before: email to operations
     - 15 days before: email + in-app to operations + admin
     - 7 days before: WhatsApp + email to operations + admin
     - 1 day before: WhatsApp + email + URGENT in-app to admin
   - Deal stage → OQOOD_PENDING

4. **Oqood Certificate Received**
   - DLD sends Oqood certificate (typically 20-45 days)
   - Staff uploads certificate to deal documents
   - Document type = OQOOD_CERTIFICATE
   - Deal stage → OQOOD_REGISTERED
   - Log activity: "Oqood certificate received"
   - **★ COMMISSION NOW UNLOCKED ★**
     - System checks: deal.spaSignedDate IS NOT NULL AND deal.oqoodRegisteredDate IS NOT NULL
     - Commission status changes: NOT_DUE → PENDING_APPROVAL
     - Create auto-task: "Confirm broker commission eligibility"
     - Notify FINANCE role: commission ready for review

**Checkpoints:**
- Deal stage progresses: SPA_SENT → SPA_SIGNED → OQOOD_PENDING → OQOOD_REGISTERED
- Oqood countdown visible in deal detail (red if <7 days)
- Signed SPA and Oqood certificate both uploaded
- Commission status unlocks when both documents confirmed
- Alerts fired at 30/15/7/1 day marks

---

### Workflow 4: Payment Tracking & Overdue Detection (ongoing)

1. **Daily Overdue Detection Job** (7:00 AM UAE time)
   - System scans all payments: WHERE status = PENDING AND dueDate < today
   - Mark as OVERDUE (status change logged in payment_audit_log)
   - Fire event: payment.overdue
   - Send WhatsApp + email to assigned staff + lead
   - Create task: "Follow up overdue payment with [lead]"
   - In-app notification to assigned staff + manager

2. **Payment Due Reminders** (7:00 AM UAE time, daily)
   - Find payments due in: 7 days, 3 days, 1 day
   - Send reminders:
     - 7 days before: email to assigned staff
     - 3 days before: WhatsApp + email to staff + lead
     - Due date: WhatsApp + email to staff + lead
   - Create in-app notification for staff

3. **Mark Payment Received**
   - Staff clicks payment row → "Mark Paid" button
   - Form pops up:
     - Paid date (default = today)
     - Payment method (dropdown: BANK_TRANSFER, CHEQUE, CASH, PDC, ONLINE)
     - Receipt upload (R2 file)
     - Notes (optional)
   - System validates:
     - Amount matches milestone amount (cannot change)
     - Receipt file is valid (PDF, image, no HTML)
   - Mark button → payment status = PAID
   - Log in payment_audit_log: action=MARKED_PAID, user, timestamp, receipt key
   - Activity log: "Payment [label] received"
   - Notification to assigned staff + manager: payment received

4. **PDC (Post-Dated Cheque) Workflow**
   - Staff selects "Mark as PDC"
   - Form: cheque number, cheque date, bank name, notes
   - Status → PDC_PENDING
   - System tracks: when cheque date arrives, staff marks "PDC Cleared"
   - Status → PDC_CLEARED
   - Or if cheque bounces: "PDC Bounced"
   - Status → PDC_BOUNCED (requires re-payment)

5. **Overdue Payment Follow-up**
   - Assigned staff sees OVERDUE task
   - Calls/WhatsApps lead to collect
   - Logs activity: CALL or WHATSAPP type, outcome (e.g., "Promised payment by Friday")
   - If payment still overdue after 7 days: escalate to manager (in-app flag)

**Checkpoints:**
- Payment status changes: PENDING → (7+ days late) → OVERDUE
- Reminders sent at: 7 days, 3 days, due date
- Payment marked PAID locked from editing (audit log if admin override needed)
- PDC tracked separately with cheque number + date

---

### Workflow 5: Commission Approval & Payout (after Oqood registered)

1. **Commission Auto-Unlock**
   - System detects: deal.spaSignedDate IS NOT NULL AND deal.oqoodRegisteredDate IS NOT NULL
   - Commission status automatically changes: NOT_DUE → PENDING_APPROVAL
   - Create auto-task: "Approve broker commission for [deal]"
   - Notify FINANCE role: "Commission ready for review"

2. **Finance Reviews Commission**
   - FINANCE staff navigates to: Brokers → Commission Dashboard → Pending Approval
   - Shows:
     - Broker company name
     - Deal info (unit + lead)
     - Sale price
     - Commission amount (locked = sale price × broker company commission rate)
     - SPA signed date ✓
     - Oqood registered date ✓
   - Click "Review" → shows details
   - Verify: amounts correct, deal fully booked

3. **Admin Approves Commission**
   - FINANCE clicks "Approve Commission"
   - ADMIN reviews (optional manual step for high-value deals)
   - Click "Confirm Approval"
   - Commission status → APPROVED
   - Log in activity: who approved, when
   - Create task: "Process commission payment to [broker company]"

4. **Mark Commission as Paid**
   - ADMIN staff processes payment to broker company (external)
   - Returns to Commission detail → click "Mark as Paid"
   - Form:
     - Payment reference (external reference number)
     - Document upload (Form A or payment proof)
     - Notes
   - System validates: document uploaded (required)
   - Commission status → PAID
   - Log in audit: timestamp, payment reference, who marked paid
   - Activity log: "Commission paid"

5. **Commission Forfeiture** (if deal cancelled before Oqood)
   - If deal is cancelled before oqoodRegisteredDate set:
   - Commission status automatically → FORFEITED
   - No payout allowed
   - Activity log: "Commission forfeited due to deal cancellation"

**Checkpoints:**
- Commission unlocks automatically (NOT_DUE → PENDING_APPROVAL) when SPA signed AND Oqood registered
- FINANCE can only approve once both conditions met
- Commission amount locked (cannot change)
- Payment reference + document required before marking PAID
- Cancelled deals forfeit commission automatically

---

### Workflow 6: Deal Cancellation (Admin-only)

1. **Request Cancellation**
   - Lead calls to cancel deal
   - Or internal decision to cancel
   - Assigned staff logs note/activity

2. **ADMIN Initiates Cancellation**
   - Deal detail → click "Cancel Deal"
   - Form (required):
     - Cancellation reason (text area)
     - Who is cancelling (dropdown: BUYER_REQUEST, BUYER_DEFAULT, INTERNAL, OTHER)
   - Click confirm

3. **System Auto-Actions**
   - Deal stage → CANCELLED
   - Unit status → AVAILABLE (returns to inventory)
   - All PENDING payments → remain as historical records (immutable)
   - Commission status → FORFEITED (if not yet paid)
   - Activity log: "Deal cancelled - [reason]"
   - Notification: cancel confirmation sent to lead + staff

4. **Post-Cancellation**
   - Unit can now be reserved by another lead
   - Lead can be marked LOST or left in system for re-contact
   - Payments already received: remain in system as proof of partial payment
   - No refund mechanism in system (handled externally)

**Checkpoints:**
- Only ADMIN can cancel
- Reason mandatory
- Unit returns to AVAILABLE
- All payments frozen (not deleted)
- Commission forfeited if not yet registered

---

## REAL ESTATE BEST PRACTICES

### 1. Payment & Financial Workflow

**Best Practice:** Milestone-based payment plans aligned with construction stages

**Implementation in Samha CRM:**
- Payment plans configured per project (30/70 standard, 40/60 cash discount, etc.)
- Milestones linked to construction stages (not just calendar dates)
- Examples:
  - 5% on booking
  - 15% on booking completion + DLD + admin fees
  - 10-20% at foundation completion
  - 15% at frame completion
  - 15-20% at finishing stage 1
  - 20% at handover
- Automatic reminders triggered by milestone status (overdue detection job)
- PDC (post-dated cheque) tracking built-in
- Every payment locked once marked PAID (audit-proof)

**Best Practice:** DLD (Dubai Land Department) fee calculation & tracking

**Implementation:**
- DLD fee = 4% of sale price (UAE law)
- Auto-calculated at deal creation
- Locked amount (cannot change)
- Separate line item in payment schedule
- Tracked separately in reports

**Best Practice:** Admin fees & transaction costs

**Implementation:**
- Fixed AED 5,000 admin fee per deal (collected at booking)
- Separate payment line item
- Covers: processing, documentation, coordination
- Non-refundable

---

### 2. Contract & Legal Workflow

**Best Practice:** SPA (Sale & Purchase Agreement) as contract gateway

**Implementation in Samha CRM:**
- SPA generated automatically from deal data
- Pre-filled with: buyer name, unit specs, price, payment schedule
- Sent via e-signature platform (Documenso)
- Status tracked: PENDING → SENT → SIGNED
- No deal can progress past SPA_SENT without signed document
- Signed SPA stored in system with version control

**Best Practice:** Document expiry tracking

**Implementation:**
- Passport expiry dates tracked
- Emirates ID expiry tracked
- RERA card expiry (broker agents) tracked
- Trade license expiry (broker companies) tracked
- Automated alerts:
  - 60 days before expiry: email notification
  - 30 days before expiry: email + in-app notification
  - On expiry date: flagged as EXPIRED

**Best Practice:** Regulatory compliance

**Implementation:**
- Oqood registration tracking (mandatory for Dubai properties)
- 90-day deadline from reservation (enforced by system)
- Multi-level alerts: 30/15/7/1 day countdown
- Oqood registration mandatory before commission payment
- Deal cannot be completed without Oqood

---

### 3. Broker Management & Commission Workflow

**Best Practice:** Broker company vs broker agent distinction

**Implementation in Samha CRM:**
- **Broker Company:** legal entity, has commission rate (e.g., 4%), may have multiple agents
- **Broker Agent:** individual at broker company, has RERA card, assigned to leads
- Commission paid to **company** (not individual agent)
- Company commission rate applies to all deals from that company's agents

**Best Practice:** Commission unlock gates

**Implementation:**
- Commission NOT DUE initially
- Becomes PENDING_APPROVAL only when **BOTH** conditions met:
  1. SPA is signed (deal.spaSignedDate IS NOT NULL)
  2. Oqood is registered (deal.oqoodRegisteredDate IS NOT NULL)
- Prevents commission disputes (agent cannot claim commission until full contract in place)
- ADMIN/FINANCE approval required before payment
- Payment must have supporting document (Form A)

**Best Practice:** Broker performance tracking

**Implementation:**
- Commission report shows: deals per broker, total commission value, pending/approved/paid breakdown
- RERA compliance: broker license expiry tracking
- Agent RERA card expiry alerts
- Broker company status (ACTIVE/INACTIVE/BLOCKED)

---

### 4. Lead Management & Conversion Tracking

**Best Practice:** Multi-unit interest tracking

**Implementation in Samha CRM:**
- Leads can be interested in multiple units (not locked to one)
- LeadUnitInterest junction table tracks all interests
- Primary interest flag (which unit is most likely)
- Unit shows count of interested leads
- Helps with follow-up: if lead doesn't book unit A, offer unit B

**Best Practice:** Lead source attribution

**Implementation:**
- Lead source captured: BROKER, DIRECT, WALK_IN, REFERRAL, PORTAL, SOCIAL, OTHER
- Linked to broker agent if broker-sourced
- Used for marketing attribution & ROI calculations
- Broker deals tracked separately from direct sales

**Best Practice:** Activity logging for lead history**

**Implementation:**
- All interactions logged: CALL, WHATSAPP, EMAIL, MEETING, NOTE, SITE_VISIT
- Call duration tracked (for sales analytics)
- WhatsApp message ID stored (for audit trail)
- Meeting location tracked
- Next follow-up date stored (for CRM task automation)
- Chronological timeline prevents gaps in communication

---

### 5. Reservation & Unit Locking

**Best Practice:** Unit reservation protection (single buyer lock)

**Implementation in Samha CRM:**
- Multiple leads can be INTERESTED in same unit
- Only ONE lead can RESERVE a unit at a time
- Other interested leads can be notified (manual follow-up)
- Prevents double-booking
- Clear status: which lead has reserved (unit detail shows reservedBy field)

**Best Practice:** Unit blocking mechanism

**Implementation:**
- ADMIN can BLOCK units temporarily (maintenance, hold, etc.)
- Blocked units cannot be reserved or booked
- Block reason mandatory
- Block expiry date optional (for temporary blocks)
- Used for: under renovation, pending legal, held for investor

---

### 6. Handover & Final Payment

**Best Practice:** Handover readiness checklist

**Implementation in Samha CRM:**
- Final payment (typically 70%) collected
- All prior payments marked CLEAR
- Unit status → HANDED_OVER
- Deal stage → COMPLETED
- Activity log: handover completion timestamp
- Can trigger post-handover surveys, follow-ups

---

### 7. Reporting & Analytics

**Best Practice:** Pipeline velocity reporting

**Implementation:**
- Days from RESERVATION_PENDING to COMPLETED tracked
- Median days to close deals
- Bottleneck analysis: which stage has longest delays
- Used for forecasting cash flow

**Best Practice:** Payment collection reporting

**Implementation:**
- Expected vs received by milestone
- By payment method (bank transfer, cheque, PDC, cash)
- Overdue analysis: days past due, amount, responsible buyer
- Forecasting: when remaining payments expected

**Best Practice:** Broker performance metrics

**Implementation:**
- Deals per broker (deal volume)
- Total commission owed per broker
- Commission approval & payment timeline
- Agent RERA compliance (cards not expired)

---

### 8. Notification & Communication Best Practices

**Best Practice:** Multi-channel, rule-based alerts

**Implementation:**
- **Email:** formal notifications (SPA sent, Oqood deadline, commission approved)
- **WhatsApp:** urgent reminders (payment overdue, imminent deadline)
- **In-app:** real-time alerts (task created, deal stage changed)
- **SMS:** fallback (optional)
- Rules by role: ADMIN gets all urgent alerts, SALES gets assigned deal alerts only

**Best Practice:** Reminder timing aligned with payment realities

**Implementation:**
- 7 days before: email to staff (time for follow-up call)
- 3 days before: WhatsApp to buyer (time to process)
- 1 day before: WhatsApp + in-app (last chance)
- Overdue (7+ days): escalate to manager

---

## USER ROLES & PERMISSIONS

### Role Definitions & Capabilities

| Role | Permissions | Typical User |
|------|---|---|
| **ADMIN** | Full access to all data, settings, user management, system configuration, RBAC | Company owner / manager |
| **SALES** | Create/edit leads, manage own assigned deals, mark payment received, view reports, cannot approve commissions | Sales agents, account executives |
| **OPERATIONS** | Manage all deals (not create), track documents, manage payment plans, submit Oqood registrations, cannot approve payments | Ops manager, coordinator |
| **FINANCE** | View all deals/payments (read-only), approve payments, approve commissions, manage payment schedules, generate financial reports | Finance manager, accountant |
| **READONLY** | View-only access to all data, no changes allowed | External reviewers, auditors |

### Permission Matrix

| Feature | ADMIN | SALES | OPS | FINANCE | READONLY |
|---------|-------|-------|-----|---------|----------|
| Create Project | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Projects | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Project | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Units | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change Unit Status | ✅ | ✅ | ✅ | ❌ | ❌ |
| Block Unit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Lead | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Lead | ✅ | ✅* | ❌ | ❌ | ❌ |
| View All Leads | ✅ | ✅* | ✅ | ✅ | ✅ |
| Create Deal | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Deal | ✅ | ✅* | ✅ | ❌ | ❌ |
| Cancel Deal | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All Deals | ✅ | ✅* | ✅ | ✅ | ✅ |
| Mark Payment Paid | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve Payment | ✅ | ❌ | ❌ | ✅ | ❌ |
| Approve Commission | ✅ | ❌ | ❌ | ✅ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin Override | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Own assigned deals/leads only

---

## DEPLOYMENT & ENVIRONMENT

### Production Stack
- **Frontend:** React 18 + Vite, built and served by Express
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL (managed by Railway)
- **Storage:** Cloudflare R2 (documents, floor plans, receipts)
- **Email:** Resend (alerts, reminders, digests)
- **WhatsApp:** 360dialog API (buyer reminders, alerts)
- **E-Signature:** Documenso (self-hosted on Railway)
- **Auth:** Clerk (login, role management, sessions)
- **Hosting:** Railway (app + database, ~$20/month)

### Environment Variables Required
```
DATABASE_URL=postgresql://user:password@host:5432/db
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=samha-crm
RESEND_API_KEY=re_...
WHATSAPP_API_KEY=...
DOCUMENSO_URL=https://documenso.railway.internal
NODE_ENV=production
```

---

**Document Version:** 2.0 | **Last Updated:** April 23, 2026 | **Next Review:** After Phase 4 completion
