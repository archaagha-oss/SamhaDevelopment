# 02 — Data Models & Database Schema
**Samha Development CRM**

---

## Design Principles

1. No JSON fields for anything that needs to be queried, filtered, or reported
2. Every status change goes through a service layer — never direct DB update from a controller
3. Financial records are immutable once confirmed — audit log on every change
4. Documents stored by file key (R2 path) — signed URLs generated on request, never stored
5. Soft deletes only — `isDeleted` flag, nothing is ever hard-deleted
6. All primary keys are UUIDs
7. Broker = company. Broker Agent = person at that company. These are two separate tables.

---

## Entity Relationship Overview

```
projects ──< units ──< unit_status_history
                │
                └──< leads >── broker_agents >── broker_companies
                      │              │
                      │         commissions
                      │
                      └──< deals >── payment_plans >── payment_plan_milestones
                            │              │
                            │         payments >── payment_audit_log
                            │
                            └──< documents
                            └──< tasks
                            └──< activities

users (cross-cutting — FK in most tables)
notifications (per user)
```

---

## TABLE: projects

```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
name              VARCHAR     NOT NULL
location          VARCHAR     NOT NULL
totalUnits        INT         NOT NULL
reraPermitNumber  VARCHAR
escrowAccount     VARCHAR
constructionStart DATE
handoverDate      DATE
status            VARCHAR     NOT NULL DEFAULT 'ACTIVE'
                  -- ENUM: PRESALE | ACTIVE | COMPLETED
createdAt         TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt         TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## TABLE: units

```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
projectId         UUID        NOT NULL REFERENCES projects(id)
unitNumber        VARCHAR     NOT NULL  -- e.g. "301", "A-1204"
floor             INT         NOT NULL
type              VARCHAR     NOT NULL
                  -- ENUM: STUDIO | 1BR | 2BR | 3BR | PENTHOUSE | COMMERCIAL
areaSqft          DECIMAL(10,2) NOT NULL
sellingPrice      DECIMAL(14,2) NOT NULL
serviceCharge     DECIMAL(10,2)  -- AED per sqft per year
view              VARCHAR
                  -- ENUM: SEA | GARDEN | CITY | POOL | STREET | NONE
parkingIncluded   BOOLEAN     NOT NULL DEFAULT false
status            VARCHAR     NOT NULL DEFAULT 'AVAILABLE'
                  -- ENUM: AVAILABLE | INTERESTED | RESERVED | BOOKED | SOLD | BLOCKED | HANDED_OVER
blockedReason     TEXT        -- required when status = BLOCKED
floorPlanKey      VARCHAR     -- Cloudflare R2 file key
createdAt         TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt         TIMESTAMP   NOT NULL DEFAULT NOW()

UNIQUE(projectId, unitNumber)
```

**Status transition rules (enforced in unit.service.ts):**
```
AVAILABLE   → INTERESTED (lead flags interest)
AVAILABLE   → RESERVED   (lead pays 5% booking)
AVAILABLE   → BLOCKED    (ADMIN only)
INTERESTED  → RESERVED   (lead proceeds to booking)
INTERESTED  → AVAILABLE  (lead withdraws, no more interest)
RESERVED    → BOOKED     (15% + DLD + admin paid)
RESERVED    → AVAILABLE  (lead cancels before booking payment)
BOOKED      → SOLD       (deal created and confirmed)
BOOKED      → AVAILABLE  (deal cancelled before SPA)
SOLD        → HANDED_OVER (final payment + handover)
BLOCKED     → AVAILABLE  (ADMIN unblocks)
ANY         → BLOCKED    (ADMIN only, with reason)
```

---

## TABLE: unit_status_history

```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
unitId        UUID        NOT NULL REFERENCES units(id)
fromStatus    VARCHAR     NOT NULL
toStatus      VARCHAR     NOT NULL
changedBy     UUID        NOT NULL REFERENCES users(id)
reason        TEXT
dealId        UUID        REFERENCES deals(id)  -- if change was triggered by a deal
createdAt     TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(unitId)
```

*Every status change writes a row here. No exceptions.*

---

## TABLE: broker_companies

```sql
id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid()
companyName           VARCHAR     NOT NULL
tradeLicenseNumber    VARCHAR
reraLicenseNumber     VARCHAR
reraLicenseExpiry     DATE
email                 VARCHAR
phone                 VARCHAR
address               TEXT
commissionRate        DECIMAL(5,2) NOT NULL DEFAULT 4.00  -- percentage
status                VARCHAR     NOT NULL DEFAULT 'ACTIVE'
                      -- ENUM: ACTIVE | INACTIVE | BLOCKED
notes                 TEXT
createdAt             TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt             TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## TABLE: broker_agents

```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
brokerCompanyId   UUID        NOT NULL REFERENCES broker_companies(id)
firstName         VARCHAR     NOT NULL
lastName          VARCHAR     NOT NULL
email             VARCHAR
phone             VARCHAR     NOT NULL
reraCardNumber    VARCHAR
reraCardExpiry    DATE
status            VARCHAR     NOT NULL DEFAULT 'ACTIVE'
                  -- ENUM: ACTIVE | INACTIVE
notes             TEXT
createdAt         TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt         TIMESTAMP   NOT NULL DEFAULT NOW()
```

**Relationship:**
- One `broker_company` has many `broker_agents`
- A lead is assigned to a `broker_agent`
- Commission is owed to the `broker_company` (not the agent)
- The agent's `broker_company.commissionRate` is used for commission calculation

---

## TABLE: leads

```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
projectId         UUID        NOT NULL REFERENCES projects(id)
firstName         VARCHAR     NOT NULL
lastName          VARCHAR     NOT NULL
email             VARCHAR
phone             VARCHAR     NOT NULL
nationality       VARCHAR
source            VARCHAR     NOT NULL
                  -- ENUM: BROKER | DIRECT | WALK_IN | REFERRAL | PORTAL | SOCIAL | OTHER
brokerAgentId     UUID        REFERENCES broker_agents(id)  -- null if direct
assignedTo        UUID        NOT NULL REFERENCES users(id)
budget            DECIMAL(14,2)
status            VARCHAR     NOT NULL DEFAULT 'NEW'
                  -- ENUM: NEW | CONTACTED | OFFER_SENT | SITE_VISIT | NEGOTIATING | CONVERTED | LOST | DORMANT
lostReason        TEXT
notes             TEXT
isDeleted         BOOLEAN     NOT NULL DEFAULT false
createdAt         TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt         TIMESTAMP   NOT NULL DEFAULT NOW()

UNIQUE(phone)  -- duplicate detection
INDEX(status, assignedTo, projectId)
```

---

## TABLE: lead_unit_interests

```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
leadId      UUID        NOT NULL REFERENCES leads(id)
unitId      UUID        NOT NULL REFERENCES units(id)
isPrimary   BOOLEAN     NOT NULL DEFAULT false
notes       TEXT
createdAt   TIMESTAMP   NOT NULL DEFAULT NOW()

UNIQUE(leadId, unitId)
```

*Separate junction table — a lead can be interested in multiple units.
Unit shows a count of active interested leads.*

---

## TABLE: payment_plans

```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
projectId     UUID        NOT NULL REFERENCES projects(id)
name          VARCHAR     NOT NULL  -- e.g. "30/70 Standard", "40/60 Cash Discount"
description   TEXT
isActive      BOOLEAN     NOT NULL DEFAULT true
createdAt     TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt     TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## TABLE: payment_plan_milestones

```sql
id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid()
paymentPlanId       UUID        NOT NULL REFERENCES payment_plans(id)
label               VARCHAR     NOT NULL  -- e.g. "Booking Deposit", "Handover Payment"
percentage          DECIMAL(5,2) NOT NULL  -- e.g. 5.00, 15.00, 70.00
triggerType         VARCHAR     NOT NULL
                    -- ENUM: ON_BOOKING | ON_DATE | DAYS_AFTER_PREVIOUS | ON_CONSTRUCTION_STAGE | ON_HANDOVER
triggerDate         DATE        -- used when triggerType = ON_DATE
constructionStage   VARCHAR     -- used when triggerType = ON_CONSTRUCTION_STAGE
daysAfterPrevious   INT         -- used when triggerType = DAYS_AFTER_PREVIOUS
sortOrder           INT         NOT NULL  -- defines payment sequence
isDLDFee            BOOLEAN     NOT NULL DEFAULT false   -- marks the 4% DLD milestone
isAdminFee          BOOLEAN     NOT NULL DEFAULT false   -- marks the AED 5,000 admin milestone
createdAt           TIMESTAMP   NOT NULL DEFAULT NOW()
```

*Milestones are rows — fully queryable and reportable. No JSON.*

**Example: 30/70 Standard Plan milestones**
```
sortOrder | label                   | percentage | triggerType       | isDLDFee | isAdminFee
1         | Booking Deposit         | 5.00       | ON_BOOKING        | false    | false
2         | DLD Fee                 | 4.00       | ON_BOOKING        | true     | false
3         | Admin Fee (AED 5,000)   | 0.00*      | ON_BOOKING        | false    | true
4         | Second Installment      | 15.00      | DAYS_AFTER_PREV   | false    | false
5         | Construction Milestone  | 10.00      | ON_CONSTRUCTION_STAGE | false | false
6         | Handover Payment        | 70.00      | ON_HANDOVER       | false    | false

* Admin fee is a fixed amount (5000 AED), percentage = 0, amount calculated separately
```

---

## TABLE: deals

```sql
id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid()
projectId             UUID        NOT NULL REFERENCES projects(id)
unitId                UUID        NOT NULL REFERENCES units(id)
leadId                UUID        NOT NULL REFERENCES leads(id)
brokerAgentId         UUID        REFERENCES broker_agents(id)  -- null if direct sale
paymentPlanId         UUID        NOT NULL REFERENCES payment_plans(id)
assignedTo            UUID        NOT NULL REFERENCES users(id)

-- Financials (locked at deal creation)
salePrice             DECIMAL(14,2) NOT NULL
discountAmount        DECIMAL(14,2) NOT NULL DEFAULT 0
discountReason        TEXT
dldFeeAmount          DECIMAL(14,2) NOT NULL  -- = salePrice × 0.04 (locked)
adminFeeAmount        DECIMAL(14,2) NOT NULL DEFAULT 5000  -- fixed
brokerCommissionAmount DECIMAL(14,2)  -- = salePrice × brokerCompany.commissionRate (locked at creation)

-- Stage
stage                 VARCHAR     NOT NULL DEFAULT 'RESERVATION_PENDING'
                      -- ENUM:
                      --   RESERVATION_PENDING     (5% paid, unit reserved)
                      --   RESERVATION_CONFIRMED   (15% + DLD + admin paid)
                      --   SPA_PENDING             (deal confirmed, SPA not yet sent)
                      --   SPA_SENT                (SPA sent for signature)
                      --   SPA_SIGNED              (signed SPA uploaded)
                      --   OQOOD_PENDING           (SPA signed, registration in progress)
                      --   OQOOD_REGISTERED        (Oqood certificate uploaded)
                      --   INSTALLMENTS_ACTIVE     (construction payments ongoing)
                      --   HANDOVER_PENDING        (final payment due)
                      --   COMPLETED               (unit handed over, all paid)
                      --   CANCELLED               (deal cancelled)

-- Key dates
reservationDate       DATE        NOT NULL
spasentDate           DATE
spaSignedDate         DATE
oqoodRegisteredDate   DATE
handoverDate          DATE
oqoodDeadline         DATE        -- = reservationDate + 90 days (auto-calculated)

-- Commission state
commissionStatus      VARCHAR     NOT NULL DEFAULT 'NOT_DUE'
                      -- ENUM: NOT_DUE | PENDING_APPROVAL | APPROVED | PAID | FORFEITED

-- Cancellation
cancelledReason       TEXT
cancelledBy           UUID        REFERENCES users(id)
cancelledAt           TIMESTAMP

notes                 TEXT
createdAt             TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt             TIMESTAMP   NOT NULL DEFAULT NOW()

UNIQUE(unitId)  -- one active deal per unit at a time
INDEX(stage, projectId, assignedTo)
```

**Commission unlock logic (enforced in commission.service.ts):**
```
commissionStatus can only move to PENDING_APPROVAL when:
  deal.spaSignedDate IS NOT NULL
  AND deal.oqoodRegisteredDate IS NOT NULL
  AND deal.stage = 'OQOOD_REGISTERED'

commissionStatus can only move to APPROVED by ADMIN or FINANCE role
commissionStatus can only move to PAID when a commission document is uploaded
commissionStatus → FORFEITED when deal.stage → CANCELLED before OQOOD_REGISTERED
```

---

## TABLE: payments

```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
dealId            UUID        NOT NULL REFERENCES deals(id)
milestoneId       UUID        NOT NULL REFERENCES payment_plan_milestones(id)
label             VARCHAR     NOT NULL  -- copied from milestone at deal creation
amount            DECIMAL(14,2) NOT NULL  -- calculated and locked at deal creation
dueDate           DATE        NOT NULL
paidDate          DATE
status            VARCHAR     NOT NULL DEFAULT 'PENDING'
                  -- ENUM: PENDING | PAID | OVERDUE | WAIVED | PDC_PENDING | PDC_CLEARED | PDC_BOUNCED
paymentMethod     VARCHAR
                  -- ENUM: BANK_TRANSFER | CHEQUE | CASH | PDC | ONLINE
receiptKey        VARCHAR     -- Cloudflare R2 file key (never raw URL)
chequeNumber      VARCHAR     -- for CHEQUE or PDC
bankName          VARCHAR
chequeDate        DATE        -- for PDC: date on the cheque
paidBy            UUID        REFERENCES users(id)  -- who marked it received
notes             TEXT
isDeleted         BOOLEAN     NOT NULL DEFAULT false

createdAt         TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt         TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(dealId, status, dueDate)
```

**Immutability rules:**
- Once `status = PAID`, the record is locked — no field can be updated
- Any correction requires an admin override which creates a payment_audit_log entry
- A WAIVED payment creates a new audit log entry, original record unchanged

---

## TABLE: payment_audit_log

```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
paymentId     UUID        NOT NULL REFERENCES payments(id)
userId        UUID        NOT NULL REFERENCES users(id)
action        VARCHAR     NOT NULL
              -- ENUM: CREATED | MARKED_PAID | MARKED_OVERDUE | WAIVED | PDC_CLEARED | PDC_BOUNCED | ADMIN_OVERRIDE
oldValues     JSONB       -- snapshot of changed fields before
newValues     JSONB       -- snapshot after
reason        TEXT
createdAt     TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## TABLE: commissions

```sql
id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid()
dealId                UUID        NOT NULL REFERENCES deals(id)
brokerCompanyId       UUID        NOT NULL REFERENCES broker_companies(id)
brokerAgentId         UUID        REFERENCES broker_agents(id)
amount                DECIMAL(14,2) NOT NULL  -- locked at deal creation
status                VARCHAR     NOT NULL DEFAULT 'NOT_DUE'
                      -- ENUM: NOT_DUE | PENDING_APPROVAL | APPROVED | PAID | FORFEITED
approvedBy            UUID        REFERENCES users(id)
approvedAt            TIMESTAMP
paidAt                TIMESTAMP
paymentReference      VARCHAR     -- external payment reference
documentKey           VARCHAR     -- R2 key for Form A or commission payment proof
notes                 TEXT
createdAt             TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt             TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## TABLE: documents

```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
entityType    VARCHAR     NOT NULL
              -- ENUM: DEAL | LEAD | BROKER_COMPANY | BROKER_AGENT | UNIT
entityId      UUID        NOT NULL
type          VARCHAR     NOT NULL
              -- ENUM:
              --   PASSPORT | EMIRATES_ID | VISA
              --   SALES_OFFER | RESERVATION_FORM
              --   SPA | SIGNED_SPA
              --   OQOOD_CERTIFICATE
              --   PAYMENT_RECEIPT
              --   BROKER_COMPANY_LICENSE | BROKER_RERA_CARD | FORM_A
              --   FLOOR_PLAN | BROCHURE | OTHER
fileKey       VARCHAR     NOT NULL  -- R2 storage path
fileName      VARCHAR     NOT NULL  -- original file name for display
fileSize      INT
mimeType      VARCHAR
version       INT         NOT NULL DEFAULT 1
uploadedBy    UUID        NOT NULL REFERENCES users(id)
expiryDate    DATE        -- passports, RERA cards, trade licenses
status        VARCHAR     NOT NULL DEFAULT 'RECEIVED'
              -- ENUM: PENDING | RECEIVED | EXPIRED | REJECTED
isDeleted     BOOLEAN     NOT NULL DEFAULT false
deletedBy     UUID        REFERENCES users(id)
notes         TEXT
createdAt     TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(entityType, entityId)
INDEX(expiryDate) -- for expiry alert jobs
```

---

## TABLE: activities

```sql
id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid()
entityType          VARCHAR     NOT NULL
                    -- ENUM: LEAD | DEAL | BROKER_COMPANY | BROKER_AGENT
entityId            UUID        NOT NULL
userId              UUID        NOT NULL REFERENCES users(id)
type                VARCHAR     NOT NULL
                    -- ENUM:
                    --   CALL | WHATSAPP | EMAIL | MEETING | NOTE | SITE_VISIT
                    --   STAGE_CHANGE | DOCUMENT_UPLOADED | PAYMENT_RECEIVED | TASK_COMPLETED
summary             TEXT        NOT NULL
outcome             TEXT
nextFollowUpDate    DATE
-- Structured fields by type
callDuration        INT         -- seconds, for CALL
whatsappMessageId   VARCHAR     -- for WHATSAPP (from 360dialog)
meetingLocation     VARCHAR     -- for MEETING
previousStage       VARCHAR     -- for STAGE_CHANGE
newStage            VARCHAR     -- for STAGE_CHANGE
createdAt           TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(entityType, entityId)
```

---

## TABLE: tasks

```sql
id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid()
assignedTo          UUID        NOT NULL REFERENCES users(id)
createdBy           UUID        NOT NULL REFERENCES users(id)
entityType          VARCHAR     NOT NULL
                    -- ENUM: LEAD | DEAL | BROKER_COMPANY
entityId            UUID        NOT NULL
title               VARCHAR     NOT NULL
description         TEXT
dueDate             DATE        NOT NULL
priority            VARCHAR     NOT NULL DEFAULT 'MEDIUM'
                    -- ENUM: LOW | MEDIUM | HIGH | URGENT
status              VARCHAR     NOT NULL DEFAULT 'OPEN'
                    -- ENUM: OPEN | IN_PROGRESS | DONE | CANCELLED
isAutoGenerated     BOOLEAN     NOT NULL DEFAULT false
reminderSentAt      TIMESTAMP
completedAt         TIMESTAMP
createdAt           TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt           TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(assignedTo, status, dueDate)
```

**Auto-generated tasks (fired by event system):**

| Trigger Event | Task Created | Assigned To |
|---|---|---|
| Deal created | "Send SPA to buyer" | Deal assignedTo |
| Deal created | "Collect 15% + DLD payment" | Deal assignedTo |
| Deal stage → SPA_SIGNED | "Submit Oqood registration" | OPERATIONS |
| Deal stage → OQOOD_REGISTERED | "Confirm broker commission eligibility" | FINANCE |
| Payment → OVERDUE 7+ days | "Follow up overdue payment with buyer" | Deal assignedTo |
| Lead created | "First contact within 24h" | Lead assignedTo |
| RERA card expiry in 30 days | "Renew broker RERA card" | OPERATIONS |

---

## TABLE: notifications

```sql
id              UUID        PRIMARY KEY DEFAULT gen_random_uuid()
userId          UUID        NOT NULL REFERENCES users(id)
type            VARCHAR     NOT NULL
                -- ENUM: PAYMENT_DUE | PAYMENT_OVERDUE | OQOOD_DEADLINE | DOCUMENT_EXPIRY
                --        TASK_DUE | STAGE_CHANGED | NEW_LEAD | UNIT_RESERVED | COMMISSION_READY
title           VARCHAR     NOT NULL
message         TEXT        NOT NULL
isRead          BOOLEAN     NOT NULL DEFAULT false
entityType      VARCHAR
entityId        UUID
createdAt       TIMESTAMP   NOT NULL DEFAULT NOW()

INDEX(userId, isRead, createdAt)
```

---

## TABLE: users

```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
clerkId     VARCHAR     NOT NULL UNIQUE  -- Clerk auth user ID
name        VARCHAR     NOT NULL
email       VARCHAR     NOT NULL UNIQUE
phone       VARCHAR
role        VARCHAR     NOT NULL DEFAULT 'SALES'
            -- ENUM: ADMIN | SALES | OPERATIONS | FINANCE | READONLY
isActive    BOOLEAN     NOT NULL DEFAULT true
lastLogin   TIMESTAMP
createdAt   TIMESTAMP   NOT NULL DEFAULT NOW()
updatedAt   TIMESTAMP   NOT NULL DEFAULT NOW()
```

---

## Prisma Schema (Development-Ready)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id                String   @id @default(uuid())
  name              String
  location          String
  totalUnits        Int
  reraPermitNumber  String?
  escrowAccount     String?
  constructionStart DateTime?
  handoverDate      DateTime?
  status            String   @default("ACTIVE")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  units        Unit[]
  leads        Lead[]
  deals        Deal[]
  paymentPlans PaymentPlan[]
}

model Unit {
  id              String   @id @default(uuid())
  projectId       String
  unitNumber      String
  floor           Int
  type            String
  areaSqft        Decimal  @db.Decimal(10,2)
  sellingPrice    Decimal  @db.Decimal(14,2)
  serviceCharge   Decimal? @db.Decimal(10,2)
  view            String?
  parkingIncluded Boolean  @default(false)
  status          String   @default("AVAILABLE")
  blockedReason   String?
  floorPlanKey    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project       Project             @relation(fields: [projectId], references: [id])
  statusHistory UnitStatusHistory[]
  interests     LeadUnitInterest[]
  deal          Deal?

  @@unique([projectId, unitNumber])
  @@index([projectId, status])
}

model UnitStatusHistory {
  id         String   @id @default(uuid())
  unitId     String
  fromStatus String
  toStatus   String
  changedBy  String
  reason     String?
  dealId     String?
  createdAt  DateTime @default(now())

  unit Unit @relation(fields: [unitId], references: [id])
  @@index([unitId])
}

model BrokerCompany {
  id                   String   @id @default(uuid())
  companyName          String
  tradeLicenseNumber   String?
  reraLicenseNumber    String?
  reraLicenseExpiry    DateTime?
  email                String?
  phone                String?
  address              String?
  commissionRate       Decimal  @default(4.00) @db.Decimal(5,2)
  status               String   @default("ACTIVE")
  notes                String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  agents       BrokerAgent[]
  commissions  Commission[]
  documents    Document[]    // company license, RERA docs
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
  status          String   @default("ACTIVE")
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  brokerCompany BrokerCompany @relation(fields: [brokerCompanyId], references: [id])
  leads         Lead[]
  deals         Deal[]
  commissions   Commission[]
  documents     Document[]    // RERA card docs
}

model Lead {
  id            String   @id @default(uuid())
  projectId     String
  firstName     String
  lastName      String
  email         String?
  phone         String   @unique
  nationality   String?
  source        String
  brokerAgentId String?
  assignedTo    String
  budget        Decimal? @db.Decimal(14,2)
  status        String   @default("NEW")
  lostReason    String?
  notes         String?
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project     Project          @relation(fields: [projectId], references: [id])
  brokerAgent BrokerAgent?     @relation(fields: [brokerAgentId], references: [id])
  assignedUser User            @relation(fields: [assignedTo], references: [id])
  interests   LeadUnitInterest[]
  deals       Deal[]
  activities  Activity[]
  documents   Document[]
  tasks       Task[]

  @@index([status, assignedTo, projectId])
}

model LeadUnitInterest {
  id        String   @id @default(uuid())
  leadId    String
  unitId    String
  isPrimary Boolean  @default(false)
  notes     String?
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id])
  unit Unit @relation(fields: [unitId], references: [id])

  @@unique([leadId, unitId])
}

model PaymentPlan {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project    Project                @relation(fields: [projectId], references: [id])
  milestones PaymentPlanMilestone[]
  deals      Deal[]
}

model PaymentPlanMilestone {
  id                 String   @id @default(uuid())
  paymentPlanId      String
  label              String
  percentage         Decimal  @db.Decimal(5,2)
  triggerType        String
  triggerDate        DateTime?
  constructionStage  String?
  daysAfterPrevious  Int?
  sortOrder          Int
  isDLDFee           Boolean  @default(false)
  isAdminFee         Boolean  @default(false)
  createdAt          DateTime @default(now())

  paymentPlan PaymentPlan @relation(fields: [paymentPlanId], references: [id])
  payments    Payment[]
}

model Deal {
  id                      String   @id @default(uuid())
  projectId               String
  unitId                  String   @unique
  leadId                  String
  brokerAgentId           String?
  paymentPlanId           String
  assignedTo              String
  salePrice               Decimal  @db.Decimal(14,2)
  discountAmount          Decimal  @default(0) @db.Decimal(14,2)
  discountReason          String?
  dldFeeAmount            Decimal  @db.Decimal(14,2)
  adminFeeAmount          Decimal  @default(5000) @db.Decimal(14,2)
  brokerCommissionAmount  Decimal? @db.Decimal(14,2)
  stage                   String   @default("RESERVATION_PENDING")
  reservationDate         DateTime
  spaSentDate             DateTime?
  spaSignedDate           DateTime?
  oqoodRegisteredDate     DateTime?
  handoverDate            DateTime?
  oqoodDeadline           DateTime  // = reservationDate + 90 days
  commissionStatus        String   @default("NOT_DUE")
  cancelledReason         String?
  cancelledBy             String?
  cancelledAt             DateTime?
  notes                   String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  project      Project      @relation(fields: [projectId], references: [id])
  unit         Unit         @relation(fields: [unitId], references: [id])
  lead         Lead         @relation(fields: [leadId], references: [id])
  brokerAgent  BrokerAgent? @relation(fields: [brokerAgentId], references: [id])
  paymentPlan  PaymentPlan  @relation(fields: [paymentPlanId], references: [id])
  assignedUser User         @relation(fields: [assignedTo], references: [id])
  payments     Payment[]
  documents    Document[]
  tasks        Task[]
  activities   Activity[]
  commission   Commission?

  @@index([stage, projectId])
}

model Payment {
  id            String   @id @default(uuid())
  dealId        String
  milestoneId   String
  label         String
  amount        Decimal  @db.Decimal(14,2)
  dueDate       DateTime
  paidDate      DateTime?
  status        String   @default("PENDING")
  paymentMethod String?
  receiptKey    String?
  chequeNumber  String?
  bankName      String?
  chequeDate    DateTime?
  paidBy        String?
  notes         String?
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  deal      Deal                 @relation(fields: [dealId], references: [id])
  milestone PaymentPlanMilestone @relation(fields: [milestoneId], references: [id])
  auditLog  PaymentAuditLog[]

  @@index([dealId, status, dueDate])
}

model PaymentAuditLog {
  id        String   @id @default(uuid())
  paymentId String
  userId    String
  action    String
  oldValues Json?
  newValues Json?
  reason    String?
  createdAt DateTime @default(now())

  payment Payment @relation(fields: [paymentId], references: [id])
}

model Commission {
  id                String   @id @default(uuid())
  dealId            String   @unique
  brokerCompanyId   String
  brokerAgentId     String?
  amount            Decimal  @db.Decimal(14,2)
  status            String   @default("NOT_DUE")
  approvedBy        String?
  approvedAt        DateTime?
  paidAt            DateTime?
  paymentReference  String?
  documentKey       String?
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  deal          Deal          @relation(fields: [dealId], references: [id])
  brokerCompany BrokerCompany @relation(fields: [brokerCompanyId], references: [id])
  brokerAgent   BrokerAgent?  @relation(fields: [brokerAgentId], references: [id])
}

model Document {
  id          String   @id @default(uuid())
  entityType  String
  entityId    String
  type        String
  fileKey     String
  fileName    String
  fileSize    Int?
  mimeType    String?
  version     Int      @default(1)
  uploadedBy  String
  expiryDate  DateTime?
  status      String   @default("RECEIVED")
  isDeleted   Boolean  @default(false)
  deletedBy   String?
  notes       String?
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([expiryDate])
}

model Activity {
  id                String   @id @default(uuid())
  entityType        String
  entityId          String
  userId            String
  type              String
  summary           String
  outcome           String?
  nextFollowUpDate  DateTime?
  callDuration      Int?
  whatsappMessageId String?
  meetingLocation   String?
  previousStage     String?
  newStage          String?
  createdAt         DateTime @default(now())

  @@index([entityType, entityId])
}

model Task {
  id              String   @id @default(uuid())
  assignedTo      String
  createdBy       String
  entityType      String
  entityId        String
  title           String
  description     String?
  dueDate         DateTime
  priority        String   @default("MEDIUM")
  status          String   @default("OPEN")
  isAutoGenerated Boolean  @default(false)
  reminderSentAt  DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([assignedTo, status, dueDate])
}

model Notification {
  id          String   @id @default(uuid())
  userId      String
  type        String
  title       String
  message     String
  isRead      Boolean  @default(false)
  entityType  String?
  entityId    String?
  createdAt   DateTime @default(now())

  @@index([userId, isRead, createdAt])
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique
  name      String
  email     String   @unique
  phone     String?
  role      String   @default("SALES")
  isActive  Boolean  @default(true)
  lastLogin DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignedLeads Lead[]
  assignedDeals Deal[]
}
```
