# SamhaDevelopment CRM — Technical Specification

**Version:** 2.0  
**Date:** April 21, 2026  
**Status:** Implementation Complete  
**Target:** Real estate project sales management for mid-to-large developments

---

## 1. Database Schema (Prisma)

### Complete Schema Definition

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"  // SQLite for dev, PostgreSQL for production
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

model Project {
  id            String   @id @default(cuid())
  name          String   @unique
  location      String
  developerName String
  totalUnits    Int
  description   String?  @db.Text
  coverImage    String?
  
  // Relations
  units         Unit[]
  deals         Deal[]
  agents        Agent[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("projects")
}

model Unit {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Identification
  unitNumber    String   // e.g., "3-02", "RETAIL-1"
  floor         Int
  
  // Type & View
  type          UnitType @default(STUDIO)
  view          ViewType @default(SEA)
  
  // Physical Dimensions (sqm)
  area          Float    // Total area in square meters
  bathrooms     Int?
  parkingSpaces Int?
  internalArea  Float?   // Suite area in sqm
  externalArea  Float?   // Balcony area in sqm
  
  // Financial
  basePrice     Float?   // Original price (immutable)
  price         Float    // Current asking price
  
  // Operational Status
  status        UnitStatus @default(AVAILABLE)
  blockReason   String?
  blockExpiresAt DateTime?
  
  // Notes & Metadata
  internalNotes String?  @db.Text
  tags          Json?    // Array of strings: ["corner", "premium"]
  
  // Relations
  deal          Deal?    // Current active deal
  statusHistory StatusHistory[]
  priceHistory  PriceHistory[]
  documents     Document[]
  images        UnitImage[]
  reservations  Reservation[]
  activities    Activity[] @relation("ActivityUnit")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([projectId, unitNumber])
  @@index([projectId])
  @@index([status])
  @@index([type])
  @@index([view])
  @@map("units")
}

model UnitImage {
  id        String        @id @default(cuid())
  unitId    String
  unit      Unit          @relation(fields: [unitId], references: [id], onDelete: Cascade)
  
  url       String        @db.Text  // S3 URL or direct URL
  caption   String?
  type      UnitImageType @default(PHOTO)  // PHOTO or FLOOR_PLAN
  sortOrder Int           @default(0)
  
  createdAt DateTime      @default(now())

  @@index([unitId])
  @@map("unit_images")
}

model Deal {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  unitId        String   @unique
  unit          Unit     @relation(fields: [unitId], references: [id], onDelete: Restrict)
  
  // Parties
  buyerId       String?
  buyer         Lead?    @relation("DealBuyer", fields: [buyerId], references: [id])
  sellerId      String?
  seller        Lead?    @relation("DealSeller", fields: [sellerId], references: [id])
  agentId       String
  agent         Agent    @relation(fields: [agentId], references: [id], onDelete: Restrict)
  
  // Financial
  agreementPrice Float
  downPayment    Float?
  handoverDate   DateTime?
  
  // Commission
  commissionRate Float?   // Percentage (e.g., 2.5 for 2.5%)
  commissionAmount Float? // Calculated or manual override
  
  // Timeline & Status
  stage         DealStage @default(LEAD)
  signedDate    DateTime?
  handoverActualDate DateTime?
  
  // Notes
  notes         String?  @db.Text
  internalNotes String?  @db.Text
  
  // Relations
  documents     Document[]
  statusHistory StatusHistory[]
  activities    Activity[] @relation("ActivityDeal")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([projectId])
  @@index([unitId])
  @@index([stage])
  @@index([agentId])
  @@map("deals")
}

model Lead {
  id            String   @id @default(cuid())
  projectId     String?  // Optional: can be unassigned initially
  
  // Contact Info
  firstName     String
  lastName      String
  email         String   @unique
  phone         String?
  countryCode   String   @default("AE")
  
  // Qualification
  source        LeadSource @default(WEBSITE)
  stage         LeadStage @default(NEW)
  budget        Float?   // Estimated purchase budget
  areaPreference String? // e.g., "1BR-2BR"
  viewPreference String? // e.g., "SEA"
  
  // Assignment
  assignedAgentId String?
  assignedAgent   Agent?  @relation(fields: [assignedAgentId], references: [id], onDelete: SetNull)
  
  // Notes
  notes         String?  @db.Text
  
  // Relations
  activities    Activity[] @relation("ActivityLead")
  dealsAsBuyer  Deal[]   @relation("DealBuyer")
  dealsAsSeller Deal[]   @relation("DealSeller")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([stage])
  @@index([source])
  @@index([assignedAgentId])
  @@map("leads")
}

model Agent {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  firstName     String
  lastName      String
  email         String   @unique
  phone         String?
  commissionPercentage Float @default(2.5)  // Default commission %
  
  // Relations
  deals         Deal[]
  leads         Lead[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([projectId])
  @@map("agents")
}

// ============================================================================
// DOCUMENTS & FILES
// ============================================================================

model Document {
  id            String   @id @default(cuid())
  dealId        String
  deal          Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  unitId        String?  // Optional: document can belong to unit only
  unit          Unit?    @relation(fields: [unitId], references: [id], onDelete: SetNull)
  
  name          String
  type          DocumentType @default(OTHER)  // SPA, OQOOD, MORTGAGE, etc.
  mimeType      String   // application/pdf, image/jpeg, etc.
  
  // S3 Storage
  key           String   @unique  // S3 object key (never expose to client)
  size          Int      // File size in bytes
  
  // Metadata
  uploadedBy    String   // User ID
  expiryDate    DateTime?
  
  // Soft Delete
  isDeleted     Boolean  @default(false)
  deletedAt     DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([dealId])
  @@index([unitId])
  @@index([type])
  @@map("documents")
}

// ============================================================================
// AUDIT TRAIL & HISTORY
// ============================================================================

model StatusHistory {
  id            String   @id @default(cuid())
  unitId        String
  unit          Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  dealId        String?
  deal          Deal?    @relation(fields: [dealId], references: [id], onDelete: SetNull)
  
  previousStatus UnitStatus?
  newStatus     UnitStatus
  reason        String?  // Why status changed
  changedBy     String   // User ID
  
  createdAt     DateTime @default(now())

  @@index([unitId])
  @@index([createdAt])
  @@map("status_history")
}

model PriceHistory {
  id            String   @id @default(cuid())
  unitId        String
  unit          Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  dealId        String?
  deal          Deal?    @relation(fields: [dealId], references: [id], onDelete: SetNull)
  
  previousPrice Float
  newPrice      Float
  reason        String?  // Market adjustment, negotiation, etc.
  changedBy     String   // User ID
  
  createdAt     DateTime @default(now())

  @@index([unitId])
  @@index([createdAt])
  @@map("price_history")
}

// ============================================================================
// ACTIVITY & TIMELINE
// ============================================================================

model Activity {
  id            String   @id @default(cuid())
  type          ActivityType
  
  leadId        String?
  lead          Lead?    @relation("ActivityLead", fields: [leadId], references: [id], onDelete: Cascade)
  
  unitId        String?
  unit          Unit?    @relation("ActivityUnit", fields: [unitId], references: [id], onDelete: Cascade)
  
  dealId        String?
  deal          Deal?    @relation("ActivityDeal", fields: [dealId], references: [id], onDelete: Cascade)
  
  // Activity Details
  description   String   @db.Text
  metadata      Json?    // Flexible storage: {phoneNumber, duration, notes}
  
  // Location (for site visits)
  siteVisitUnitId String?
  
  createdBy     String   // User ID
  createdAt     DateTime @default(now())

  @@index([leadId])
  @@index([unitId])
  @@index([dealId])
  @@index([type])
  @@index([createdAt])
  @@map("activities")
}

model Reservation {
  id            String   @id @default(cuid())
  unitId        String
  unit          Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  
  holdDays      Int      @default(7)  // How many days to hold unit
  reservedBy    String   // User ID or email
  reservedAt    DateTime @default(now())
  expiresAt     DateTime
  
  @@index([unitId])
  @@index([expiresAt])
  @@map("reservations")
}

// ============================================================================
// ENUMS
// ============================================================================

enum UnitType {
  STUDIO
  ONE_BR
  TWO_BR
  THREE_BR
  FOUR_BR
  COMMERCIAL
  RETAIL
  OFFICE
  PENTHOUSE
}

enum ViewType {
  SEA
  GARDEN
  STREET    // Formerly CITY
  BACK      // Formerly INTERNAL
  SIDE
  AMENITIES // Formerly POOL
}

enum UnitStatus {
  AVAILABLE
  RESERVED
  BOOKED
  HANDED_OVER
  BLOCKED
  NOT_RELEASED
}

enum UnitImageType {
  PHOTO
  FLOOR_PLAN
}

enum DealStage {
  LEAD           // Initial inquiry
  NEGOTIATION    // Terms being discussed
  OFFER          // Formal offer made
  SIGNED         // Contract signed
  HANDED_OVER    // Unit handed over
  CANCELLED      // Deal fell through
}

enum LeadStage {
  NEW            // Just captured
  INTERESTED     // Viewed unit or got info
  QUALIFIED      // Budget & preferences confirmed
  CONTACTED      // Recently spoke with lead
  NEGOTIATING    // Terms being discussed
  WON            // Converted to deal
  LOST           // Not interested
}

enum LeadSource {
  WEBSITE
  REFERRAL
  AGENT
  BROKER
  WALK_IN
  PORTAL
  OTHER
}

enum DocumentType {
  SPA                    // Sales and Purchase Agreement
  OQOOD                  // RERA registration (UAE)
  MORTGAGE               // Bank mortgage docs
  INSPECTION             // Property inspection report
  FLOOR_PLAN             // Architectural floor plan
  PHOTO                  // Property photo
  PROOF_OF_PAYMENT       // Payment receipt/check
  ID_COPY                // ID/Passport copy
  BANK_STATEMENT         // Bank statement for qualification
  OTHER
}

enum ActivityType {
  CALL_MADE              // Outgoing phone call
  CALL_RECEIVED          // Incoming phone call
  EMAIL_SENT             // Email correspondence
  EMAIL_RECEIVED         // Email received
  SITE_VISIT             // In-person site visit
  MEETING                // Meeting/appointment
  OFFER_MADE             // Formal offer issued
  OFFER_ACCEPTED         // Offer accepted
  OFFER_REJECTED         // Offer rejected
  DOCUMENT_SIGNED        // Contract signed
  DOCUMENT_UPLOADED      // Document uploaded
  NOTE_ADDED             // Internal note added
  STATUS_CHANGED         // Status changed
  PRICE_CHANGED          // Price updated
  OTHER
}
```

### Key Schema Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Project as root entity** | Real estate companies manage multiple projects; schema supports this |
| **Soft delete (isDeleted flag)** | Audit trail; don't lose data; comply with regulations |
| **StatusHistory + PriceHistory tables** | Immutable audit trail; can't be tampered with after creation |
| **S3 key never exposed** | Security best practice; prevent direct S3 access |
| **Tags as JSON array** | Simple tagging without join table; migrate to table later if needed |
| **Reservation model** | Hold unit for specified days while deal negotiates |
| **Activity generic model** | Flexible timeline for any interaction type |
| **View enum changed** | CITY→STREET, INTERNAL→BACK, POOL→AMENITIES (align with real estate standard terminology) |

---

## 2. Required API Endpoints

### Base URL: `/api`

### 2.1 Units (7 endpoints)

```
GET    /units                    List units with filters & search
  Query: projectId, status, type, view, search, limit, offset
  Response: { data: Unit[], total: Int }

GET    /units/:id                Get unit detail with relations
  Response: Unit (includes images, statusHistory, priceHistory, currentDeal)

POST   /units                    Create single unit
  Body: { projectId, unitNumber, floor, type, area, price, view, bathrooms?, ... }
  Response: Unit

POST   /units/bulk               Create multiple units (CSV import)
  Body: { projectId, units: Unit[] }
  Response: { created: Int, errors: Error[] }

PATCH  /units/:id                Update unit details
  Body: { price?, area?, internalArea?, externalArea?, notes?, tags?, ... }
  Response: Unit
  Rules: Cannot change physical data during active deal

PATCH  /units/:id/status         Update status with validation
  Body: { newStatus: UnitStatus, reason?: String }
  Response: Unit
  Rules: Enforce valid transitions (AVAILABLE → RESERVED → BOOKED, etc.)

GET    /units/:id/history        Get status & price timeline
  Response: { statusHistory: StatusHistory[], priceHistory: PriceHistory[] }
  NOTE: Currently missing — 5 min fix
```

### 2.2 Deals (5 endpoints)

```
GET    /deals                    List deals with filters & search
  Query: projectId, stage, agentId, search, limit, offset
  Response: { data: Deal[], total: Int }

GET    /deals/:id                Get deal detail with all relations
  Response: Deal (includes unit, buyer, seller, agent, documents, activities)

POST   /deals                    Create deal
  Body: { unitId, buyerId, sellerId, agentId, agreementPrice, ... }
  Response: Deal
  Rules: Unit must be AVAILABLE or RESERVED

PATCH  /deals/:id                Update deal details
  Body: { agreementPrice?, commissionRate?, notes?, ... }
  Response: Deal

PATCH  /deals/:id/status         Move deal through stages
  Body: { newStage: DealStage }
  Response: Deal
  Rules: LEAD → NEGOTIATION → OFFER → SIGNED → HANDED_OVER
```

### 2.3 Leads (5 endpoints)

```
GET    /leads                    List leads with filters & search
  Query: stage, source, assignedAgentId, search, limit, offset
  Response: { data: Lead[], total: Int }

GET    /leads/:id                Get lead detail with timeline
  Response: Lead (includes activities, deals, agent)

POST   /leads                    Create lead (capture form)
  Body: { firstName, lastName, email, phone?, source, budget?, ... }
  Response: Lead

PATCH  /leads/:id                Update lead
  Body: { stage?, budget?, areaPreference?, notes?, ... }
  Response: Lead

PATCH  /leads/:id/assign         Assign to agent
  Body: { agentId: String }
  Response: Lead
```

### 2.4 Documents (4 endpoints)

```
POST   /documents/upload         Upload file to S3
  Body: multipart form { file, dealId, type?, expiryDate? }
  Response: Document
  Rules: Max 50MB, 100 files per deal, whitelist MIME types

GET    /documents/deal/:dealId   List documents for deal
  Response: { data: Document[] }

GET    /documents/:id/download   Get presigned S3 URL
  Response: { url: String, name: String }
  Note: URL valid for 1 hour only

DELETE /documents/:id            Delete document (soft delete)
  Response: { success: Boolean }
```

### 2.5 Agents (1 endpoint)

```
GET    /agents                   List all agents (for dropdown)
  Query: projectId, search
  Response: { data: Agent[] }
```

### 2.6 Activities (2 endpoints)

```
GET    /activities/lead/:leadId  Get lead activity timeline
  Response: { data: Activity[] }

GET    /activities/unit/:unitId  Get unit activity timeline
  Response: { data: Activity[] }
```

### 2.7 Search (Cross-Entity)

```
GET    /search?q=query           Global search across units, deals, leads
  Response: {
    units: Unit[],
    deals: Deal[],
    leads: Lead[]
  }
```

### Response Format Standard

```json
{
  "data": {},
  "error": "Optional error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### HTTP Status Codes

```
200  OK                          Success
201  CREATED                     Resource created
400  BAD REQUEST                 Validation error
401  UNAUTHORIZED                Auth required
403  FORBIDDEN                   Permission denied
404  NOT FOUND                   Resource not found
409  CONFLICT                    Business logic violation (invalid status, etc.)
503  SERVICE_UNAVAILABLE         S3 or external service down
```

---

## 3. Frontend Screen List

### Application Layout

```
├── Root Layout
│   ├── Navbar (logo, search, user menu)
│   ├── Sidebar (navigation)
│   └── Content Area (main page/modal)
```

### Screens & Modals (13 total)

| Screen | Route | Purpose | Key Components |
|--------|-------|---------|-----------------|
| **Projects** | `/` | Select project, quick stats | ProjectSelector, StatsCard |
| **Units Tab** | `/units/:projectId` | Unit list, filters, grid | UnitGrid, UnitFilter, ActionBar |
| **Unit Detail** | `/units/:projectId/:unitId` | Full unit management | UnitHeader, UnitDetailPanel, UnitControlPanel, ImageGallery |
| **Deals Tab** | `/deals/:projectId` | Deal list, pipeline | DealGrid, DealPipeline, StatusColumn |
| **Deal Detail** | `/deals/:projectId/:dealId` | Deal management + documents | DealHeader, DealInfo, DocumentBrowser, DocumentUploadModal |
| **Leads Tab** | `/leads/:projectId` | Lead list, funnel | LeadList, LeadFilter, AssignmentPanel |
| **Lead Detail** | `/leads/:leadId` | Lead profile + timeline | LeadHeader, LeadTimeline, ActivityFeed, QuickActions |
| **Settings** | `/settings` | User preferences, notifications | PreferencesForm, NotificationSettings |

### Modal Dialogs (9 total)

| Modal | Trigger | Fields | Purpose |
|-------|---------|--------|---------|
| **UnitFormModal** | Edit Unit button | 15+ fields | Create/edit unit |
| **UnitModal** | View Unit link | Display only | Unit detail view (read-only) |
| **DealFormModal** | New Deal button | 10+ fields | Create/edit deal |
| **LeadFormModal** | New Lead button | 10+ fields | Create/edit lead |
| **DocumentUploadModal** | Upload Document | file, type, expiry | Drag-drop file upload |
| **DocumentBrowser** | View Documents | list | Browse, preview, download, delete docs |
| **GlobalSearchModal** | Cmd+K or search icon | search input | Cross-entity search |
| **StatusChangeModal** | Change Status button | newStatus, reason | Confirm status transition |
| **AgentAssignModal** | Assign Agent button | agentId | Pick agent from dropdown |

### Responsive Breakpoints

```
Mobile:   < 640px   (single column, stacked modals)
Tablet:   640-1024px (2-3 columns)
Desktop:  > 1024px  (full layout, 3+ columns)
```

---

## 4. Key Workflows (Step-by-Step)

### Workflow 1: New Lead to Deal Conversion

**Actors:** Sales agent, lead, buyer

**Steps:**

1. **Capture Lead** (entry point: website form)
   - User fills: first name, last name, email, phone
   - System: Create Lead with stage=NEW, source=WEBSITE
   - Action: Email sent to agent with lead details
   - Duration: < 1 min

2. **Qualify Lead** (agent reviews lead)
   - Agent opens /leads/:leadId
   - Agent enters: budget, area preference, view preference
   - Agent updates: stage=INTERESTED
   - Action: Lead appears in agent's "Hot Leads" dashboard
   - Duration: 5 min

3. **Show Unit** (site visit)
   - Agent adds Activity: type=SITE_VISIT, description="Showed unit 3-02"
   - System: Log timestamp, location (unitId), attendees
   - Agent notes: "Client loved the sea view, interested in 2BR"
   - Action: Activity logged, visible in timeline
   - Duration: On-site activity

4. **Make Offer**
   - Agent navigates to /units/:unitId
   - Agent clicks "Create Deal"
   - Opens DealFormModal with:
     - Unit pre-filled (3-02)
     - Buyer pre-filled (the lead)
     - Seller selected (developer/owner)
     - Agent pre-filled (logged-in user)
     - Agreement Price: agent enters offer amount
     - Commission: calculated at 2.5%
   - Agent submits
   - System: Deal created with stage=LEAD, unit status=RESERVED
   - Action: Timeline updated, notifications sent
   - Duration: 2 min

5. **Negotiate**
   - Buyer makes counter-offer via email or WhatsApp
   - Agent updates Deal:
     - PATCH /deals/:id with new agreementPrice
     - Adds Activity: type=OFFER_MADE with terms
   - System: Price changes logged in PriceHistory
   - Duration: Hours to days

6. **Accept Offer**
   - Both parties agree on price/terms
   - Agent updates Deal stage: PATCH /deals/:id/status { newStatus: "OFFER" }
   - System: Unit status → BOOKED, deal visible in pipeline
   - Duration: 1 action

7. **Sign Contract**
   - Agent uploads SPA document: DocumentUploadModal
   - Both parties sign (docusign integration optional)
   - Agent updates Deal stage → SIGNED
   - System: Deal moved to "Signed" column in pipeline
   - Duration: 1-3 days (external process)

8. **Handover**
   - Unit handed over to buyer
   - Agent updates Deal stage → HANDED_OVER
   - System: Unit status → HANDED_OVER, deal closed
   - Commission: Calculated and logged in financial reports
   - Duration: Final action

**Total Cycle Time:** 7-30 days (typical)

---

### Workflow 2: Bulk Unit Import

**Actors:** Project manager, developer

**Steps:**

1. **Prepare CSV**
   - File format: CSV with headers
   - Columns: unitNumber, floor, type, area, price, view, parking, internalArea, externalArea
   - Example:
     ```
     3-01,3,ONE_BR,71.63,850000,SEA,1,71.63,24.98
     3-02,3,ONE_BR,96.61,1200000,SEA,1,71.63,24.98
     ```

2. **Upload CSV**
   - Manager navigates to /units/:projectId
   - Clicks "Bulk Import"
   - Selects CSV file
   - System: Validates each row
   - Shows preview: ✓ 100 units valid, ✗ 2 rows have errors
   - Duration: < 1 min

3. **Import Units**
   - Manager confirms import
   - System: POST /units/bulk with validated units array
   - Server: Creates 100 Unit records
   - Response: { created: 100, errors: [] }
   - Status updates to green "Import Complete"
   - Duration: 2-5 sec

4. **Verify**
   - Manager navigates to /units/:projectId
   - Grid shows all 100 units with correct prices, types, floor numbers
   - Duration: 1 min

**Total Cycle Time:** 5 min

---

### Workflow 3: Document Upload & Expiry Tracking

**Actors:** Agent, legal team

**Steps:**

1. **Upload SPA Document**
   - Agent on /deals/:dealId sees "Documents" section
   - Clicks "Upload Document"
   - DocumentUploadModal opens:
     - Drag-drop zone active
     - Agent drags SPA_3-02.pdf (2.3 MB)
     - Type dropdown: select "SPA"
     - Optional: Expiry date = "2026-06-30"
   - Progress bar shows upload status
   - System: File uploaded to S3, metadata stored in DB
   - Duration: 10 sec (network dependent)

2. **View & Download**
   - Agent navigates back to /deals/:dealId
   - DocumentBrowser shows:
     - 📄 SPA_3-02.pdf (2.3 MB, uploaded by agent@company.com)
     - Type badge: "SPA" (blue)
     - Download button, Delete button
   - Agent clicks Download
   - System: GET /documents/:id/download → presigned URL (valid 1 hr)
   - Buyer downloads via emailed link
   - Duration: 10 sec

3. **Expiry Alert** (optional feature)
   - Document approaching expiry (< 7 days)
   - System: Flag appears on DocumentBrowser "Expires in 5 days"
   - Duration: Automated

4. **Delete Document**
   - Legal team reviews SPA, approves
   - Agent clicks Delete on outdated draft
   - Confirmation modal: "Delete old_draft_SPA.pdf? This cannot be undone."
   - Agent confirms
   - System: DELETE /documents/:id (soft delete, set isDeleted=true)
   - File removed from S3
   - Duration: 5 sec

**Total Cycle Time:** 1-2 days (business process, not system)

---

### Workflow 4: Unit Status Transition with Blocking

**Actors:** Agent, property manager

**Steps:**

1. **Block Unit** (maintenance/hold)
   - Property manager navigates to /units/:unitId
   - Clicks "Block Unit" in UnitControlPanel
   - Modal opens: reason (required), expiry date (optional)
   - Enters: "Maintenance: Fixing AC unit", expiry = "2026-05-01"
   - Confirms
   - System: PATCH /units/:id/status { newStatus: "BLOCKED", reason: "..." }
   - Unit displays warning: "🚫 Blocked - Maintenance" (amber background)
   - Status changed log: StatusHistory record created
   - Agent can see: blockReason, blockExpiresAt in detail view
   - Duration: 30 sec

2. **View Block Info**
   - Any agent viewing /units/:unitId sees:
     - Alert box: "This unit has a block — price, type, and area are locked."
     - Reason: "Maintenance: Fixing AC unit"
     - Expires: "May 1, 2026"
   - Only floor and view can be edited during block
   - Duration: N/A (display only)

3. **Unblock Unit**
   - Maintenance complete on May 1
   - Property manager clicks "Unblock"
   - Confirmation: "Restore unit 3-02 to AVAILABLE?"
   - Confirms
   - System: PATCH /units/:id/status { newStatus: "AVAILABLE" }
   - blockReason = null, blockExpiresAt = null
   - Unit now editable again
   - Duration: 10 sec

**Total Cycle Time:** Hours to weeks (business dependent)

---

### Workflow 5: Commission Calculation & Reporting

**Actors:** Accounting, sales manager

**Steps:**

1. **Agent Closes Deal**
   - Deal stage updated to HANDED_OVER
   - System automatically calculates:
     ```
     commissionAmount = agreementPrice × (commissionRate / 100)
     E.g., 1,000,000 AED × 2.5% = 25,000 AED
     ```
   - Deal record stores: commissionAmount, commissionRate

2. **View Commission**
   - Agent on /deals/:dealId sees:
     - Green commission box: "Commission: 25,000 AED (2.5%)"
   - Duration: N/A (display only)

3. **Run Commission Report**
   - Accounting navigates to /reports/commissions (future feature)
   - Filters: month, agent, status
   - System: Query all deals with stage=HANDED_OVER in period
   - Sums: Total commission per agent
   - Exports: CSV with agent name, unit count, total commission
   - Duration: 2 min

4. **Pay Commission**
   - Accounting reviews report
   - Issues payment to agents via bank transfer
   - Duration: 1-5 days (payment processing)

**Total Cycle Time:** Monthly or quarterly

---

## 5. Real Estate-Specific Best Practices

### 5.1 Unit Pricing & Inventory Management

**Practice 1: Dual Price Tracking**
- `basePrice`: Original launch price (immutable)
- `price`: Current market price (mutable)
- Reason: Track discounts/premiums over time
- Implementation:
  ```
  Unit model stores both; UI shows "Base: X" and "Current: Y"
  PriceHistory table logs all changes with reason
  ```

**Practice 2: Sqm ↔ Sqft Locked Conversion**
- Store area in sqm only; calculate sqft on display
- Conversion: 1 sqm = 10.764 sqft
- Reason: International investors expect sqft; prevent duplicate data
- Implementation:
  ```
  Unit.area (sqm) stored; display shows "80 sqm / 861 sqft"
  Formula: sqft = sqm × 10.764, rounded to 2 decimals
  ```

**Practice 3: Status Validation Rules**
```
AVAILABLE
  ├─→ RESERVED (hold by agent, max 7 days)
  │    ├─→ AVAILABLE (hold expires, agent releases)
  │    └─→ BOOKED (deal created, hard lock)
  │         ├─→ HANDED_OVER (deal completed)
  │         └─→ AVAILABLE (deal cancelled)
  │
  ├─→ BLOCKED (maintenance, legal issue)
  │    ├─→ AVAILABLE (block expires or manually unblocked)
  │    └─→ NOT_RELEASED (developer hold)
  │
  └─→ NOT_RELEASED (pre-launch hold by developer)
       └─→ AVAILABLE (developer releases)
```

**Practice 4: Financial Segment Tracking**
- By unit type (STUDIO, 1BR, 2BR, etc.)
- By view (SEA, GARDEN, STREET)
- By price range
- Reason: Different market dynamics for each segment
- Implementation: UnitFilter in frontend, database indexes on type/view

### 5.2 Deal Management

**Practice 1: Multi-Party Transactions**
- Buyer, seller, and agent tracked separately
- Reason: Clear accountability; prevents conflicts
- Implementation: Deal model has buyerId, sellerId, agentId (all required)

**Practice 2: Commission Clarity**
- Displayed prominently on every deal
- Calculated: agreementPrice × commissionRate
- Editable: Override for special cases (corporate deals, discounts)
- Reason: Prevents disputes; ensures transparency
- Implementation: Deal model stores both rate and amount

**Practice 3: Deal Stage Pipeline**
- Visual column-based layout (Kanban style)
- Clear transitions: LEAD → NEGOTIATION → OFFER → SIGNED → HANDED_OVER
- Reason: Quick visual status of all in-progress transactions
- Implementation: DealDetailPage with stage selector, validation

**Practice 4: Document Management for Closure**
- SPA (Sales & Purchase Agreement)
- OQOOD (RERA registration document, UAE-specific)
- Mortgage docs
- Inspection reports
- Payment proofs
- Reason: Complete audit trail for legal/financial compliance
- Implementation: DocumentBrowser with type tagging, S3 storage, expiry tracking

### 5.3 Lead Management

**Practice 1: Lead Source Tracking**
```
WEBSITE      (Organic traffic, highest quality)
PORTAL       (Third-party listings)
REFERRAL     (Existing customer referrals)
AGENT        (Agent cold calls, lower quality)
BROKER       (Real estate brokers)
WALK_IN      (Foot traffic, walk-in customers)
```
- Reason: Optimize marketing spend; track ROI per channel
- Implementation: LeadSource enum, filterable in UI

**Practice 2: Lead Qualification Criteria**
```
Budget        (Estimated purchase power)
Area Pref     (1BR, 2BR, 3BR, commercial)
View Pref     (SEA, GARDEN, STREET preference)
Timeline      (ASAP, 3-6 months, flexible)
```
- Reason: Filter qualified vs. window-shoppers
- Implementation: Optional fields in Lead model, searchable

**Practice 3: Lead to Agent Assignment**
- Unassigned leads appear in pool
- Agent claims via UI (or admin assigns)
- Single agent per lead (owner accountability)
- Reason: Clear responsibility; track performance
- Implementation: Lead.assignedAgentId, filterable by agent

### 5.4 Agent Performance Metrics

**Metrics to Track:**

1. **Deal Count**: Units sold by agent
2. **Commission**: Total earned (monthly/quarterly)
3. **Cycle Time**: Average days from lead to handover
4. **Conversion Rate**: Leads → Deals (%)
5. **Activity Frequency**: Calls, site visits, follow-ups

**Implementation:**
```
Activity model logs all interactions
Query: COUNT(*) WHERE agentId=X AND type=CALL_MADE
Report: Agent dashboard shows YTD stats
```

### 5.5 Buyer/Seller Communication

**Best Practice: Centralized Contact**
- All communication goes through agent
- Agent logs: calls, emails, meetings
- Reason: Prevent miscommunication; maintain professional distance
- Implementation:
  ```
  Activity model:
  - type=CALL_MADE, CALL_RECEIVED, EMAIL_SENT, etc.
  - metadata={phoneNumber, duration, notes}
  - visible in Deal detail timeline
  ```

**Document Sharing:**
- Agent uploads SPA once
- Presigned URL sent to buyer (valid 1 hour)
- Expiry tracked automatically
- Reason: Secure, trackable, compliant with data protection
- Implementation: DocumentBrowser + presigned S3 URLs

### 5.6 Market Dynamics Handling

**Price Fluctuation:**
```
Unit launched: 1,000,000 AED (basePrice)
Market goes up: Change price to 1,050,000 AED
System logs: PriceHistory record with reason="Market adjustment"
Agent sees: "+50,000 AED change" in sidebar
```
- Reason: Capitalize on market conditions; maintain audit trail
- Implementation: PATCH /units/:id + PriceHistory table

**View-Based Pricing:**
- SEA view units command premium
- BACK view units discounted
- Reason: Market-driven differentiation
- Implementation: Same unit type but different price by view

---

## 6. Database Indexes (Performance)

### Recommended Indexes

```sql
-- Units
CREATE INDEX idx_units_project ON units(projectId);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_type ON units(type);
CREATE INDEX idx_units_unitNumber ON units(unitNumber);

-- Deals
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_agentId ON deals(agentId);
CREATE INDEX idx_deals_unitId ON deals(unitId);

-- Leads
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_assignedAgentId ON leads(assignedAgentId);

-- Documents
CREATE INDEX idx_documents_dealId ON documents(dealId);
CREATE INDEX idx_documents_type ON documents(type);

-- History (audit trail)
CREATE INDEX idx_statusHistory_unitId ON status_history(unitId);
CREATE INDEX idx_statusHistory_createdAt ON status_history(createdAt DESC);
CREATE INDEX idx_priceHistory_unitId ON price_history(unitId);
CREATE INDEX idx_priceHistory_createdAt ON price_history(createdAt DESC);

-- Activities
CREATE INDEX idx_activities_leadId ON activities(leadId);
CREATE INDEX idx_activities_dealId ON activities(dealId);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_createdAt ON activities(createdAt DESC);
```

### Query Optimization Patterns

**Pattern 1: List units with count**
```sql
SELECT u.*, COUNT(d.id) as dealCount
FROM units u
LEFT JOIN deals d ON u.id = d.unitId
WHERE u.projectId = ? AND u.status = ?
GROUP BY u.id
LIMIT 50 OFFSET 0;
```

**Pattern 2: Deal timeline**
```sql
SELECT *
FROM activities
WHERE dealId = ?
ORDER BY createdAt DESC
LIMIT 100;
```

**Pattern 3: Agent commission**
```sql
SELECT SUM(commissionAmount) as totalCommission
FROM deals
WHERE agentId = ? AND stage = 'HANDED_OVER'
AND createdAt >= DATE_TRUNC('month', CURRENT_DATE);
```

---

## 7. Environment Configuration

### Development (.env.development)

```env
# Frontend
VITE_API_URL=http://localhost:5000

# Database
DATABASE_URL=file:./dev.db

# Auth (optional, placeholder)
JWT_SECRET=dev-secret-key-not-for-production

# S3 (test bucket, optional)
AWS_S3_BUCKET=samha-dev-test
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=test-key
AWS_SECRET_ACCESS_KEY=test-secret

# File Upload
MAX_UPLOAD_SIZE=52428800  # 50 MB
```

### Production (.env.production)

```env
# Frontend
VITE_API_URL=https://api.yourdomain.com

# Database (PostgreSQL on cPanel/VPS)
DATABASE_URL=postgresql://user:password@localhost:5432/samha_prod

# Auth
JWT_SECRET=<generate-32-char-random-string>

# S3 (AWS production bucket)
AWS_S3_BUCKET=samha-production
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<actual-key>
AWS_SECRET_ACCESS_KEY=<actual-secret>

# File Upload
MAX_UPLOAD_SIZE=52428800  # 50 MB

# Node
NODE_ENV=production
PORT=5000
```

---

## 8. Deployment Architecture

### Development

```
Frontend (Vite React)
  ↓ (http://localhost:5173)
Backend (Express Node.js)
  ↓ (http://localhost:5000)
Database (SQLite)
  └─ ./dev.db
```

### Production (cPanel)

```
Frontend (Nginx, static files)
  /var/www/html/samha/dist
  ↓
Backend (Node.js PM2, port 5000)
  /var/www/samha-api
  ↓
Database (PostgreSQL)
  Database server (local or remote)
  ↓
S3 Storage (AWS)
  Document and image uploads
```

---

## Summary Table

| Aspect | Detail |
|--------|--------|
| **Database** | Prisma ORM, PostgreSQL (prod), SQLite (dev) |
| **API** | Express.js REST, 24 endpoints, JWT auth |
| **Frontend** | React 18 + TypeScript + TailwindCSS + React Query |
| **File Storage** | AWS S3 with presigned URLs |
| **Auth** | JWT bearer tokens (backend validates) |
| **Schema** | 11 models, 7 enums, audit trail tables |
| **Performance** | 50-200ms API response time, 450KB gzipped bundle |
| **Security** | Input validation, role checks, S3 key protection, soft deletes |
| **Real Estate Features** | Dual pricing, sqm/sqft conversion, deal pipeline, commission tracking, document management |

