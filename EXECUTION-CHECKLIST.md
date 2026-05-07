# Samha CRM - Execution Checklist

Before starting Phase 1 implementation, complete these items. The sample data is already seeded (173 units, Samha Tower), but you need to prepare your actual project data.

## ✅ Pre-Phase-1 Requirements

### 1. Project Data Preparation

- [ ] **Excel Sheet with 173 Units**
  - File: `unit-data.xlsx`
  - Columns: Unit Number, Floor, Type, Area (m²), Price (AED), View, Current Status
  - Example rows:
    ```
    1-01, 1, STUDIO, 450, 650000, SEA, AVAILABLE
    1-02, 1, ONE_BR, 750, 900000, GARDEN, SOLD
    2-01, 2, TWO_BR, 1400, 1800000, CITY, AVAILABLE
    ```
  - Status: Ready? ☐ Not Started ☐ In Progress ☐

- [ ] **Property Details**
  - [ ] Full project name (e.g., "Samha Tower")
  - [ ] Location (e.g., "Dubai Marina")
  - [ ] Total unit count (confirmed: 173)
  - [ ] Expected handover date (confirmed: Dec 2026)
  - [ ] Builder/Developer name
  - [ ] Project website (if exists)

### 2. User & Team Setup

- [ ] **User List with Roles**
  - File: `users.xlsx` or CSV
  - Columns: Name, Email, Role, Phone, Department
  - Roles: ADMIN, SALES_AGENT, OPERATIONS, FINANCE, DEVELOPER
  - Minimum users: 1 Admin, 2+ Sales Agents
  - Example:
    ```
    Mohamed Admin, admin@samha.ae, ADMIN, +971501234567, Management
    Sara Sales, sara@samha.ae, SALES_AGENT, +971501111111, Sales
    Khalid Sales, khalid@samha.ae, SALES_AGENT, +971501111112, Sales
    Fatima Ops, fatima@samha.ae, OPERATIONS, +971501111113, Operations
    Omar Finance, omar@samha.ae, FINANCE, +971501111114, Finance
    ```
  - Status: Ready? ☐ Not Started ☐ In Progress ☐

- [ ] **Auth Setup**
  - [ ] `JWT_SECRET` generated (`openssl rand -base64 64`) and set in `apps/api/.env`
  - [ ] `PASSWORD_RESET_URL_BASE` set to the deployed web origin
  - [ ] SMTP configured in `AppSettings` for password-reset emails (or mailer falls back to logging)
  - [ ] User roles assigned in seed/admin UI (ADMIN, SALES_AGENT, OPERATIONS, FINANCE, DEVELOPER)

### 3. Business Logic Decisions

Answer these 8 questions (will be used for Phase 3 implementation):

- [ ] **Question 1: Unit Status Transitions**
  - What statuses can transition to what?
  - Can SOLD units move back to AVAILABLE?
  - Can HANDED_OVER move backward?
  - Answer: ___________________________

- [ ] **Question 2: Payment Terms**
  - What's the deposit percentage required for BOOKED?
  - Payment milestones: How many and at what percentages?
  - Grace period for non-payment?
  - Answer: ___________________________

- [ ] **Question 3: Commission Structure**
  - Company vs. Agent commission split?
  - When are commissions calculated? (On BOOKED, SOLD, or HANDED_OVER?)
  - Special cases or bonuses?
  - Answer: ___________________________

- [ ] **Question 4: Document Requirements**
  - What documents required for each status?
  - SPA timing: When is it signed? (On BOOKED or SOLD?)
  - Oqood requirement: When and by whom?
  - Answer: ___________________________

- [ ] **Question 5: Alert Triggers**
  - What events should trigger notifications?
  - Who gets notified for what? (e.g., Manager if unit not sold in 30 days)
  - Escalation paths?
  - Answer: ___________________________

- [ ] **Question 6: Multiple Tower Scaling**
  - How many towers/phases planned?
  - Cross-tower commission rules?
  - Shared inventory rules?
  - Answer: ___________________________

- [ ] **Question 7: Buyer Information**
  - Capture buyer details: Name, email, phone, ID number?
  - Buyer nationality required?
  - Multiple buyers per unit?
  - Answer: ___________________________

- [ ] **Question 8: Reporting & KPIs**
  - Key metrics to track: Sales velocity, conversion rates, commission breakdown?
  - Reports needed: Daily, weekly, monthly?
  - Who needs access to what reports?
  - Answer: ___________________________

## 🗂️ File Organization

Create this folder structure in the project root:

```
samha-crm/
├── data/
│   ├── unit-data.xlsx                 (173 units)
│   ├── users.xlsx                     (team members)
│   └── business-logic-answers.md      (8 questions answered)
├── docs/
│   └── project-specifications/
│       └── (original 01-09 documents)
└── README.md
```

## 📋 Deliverables Checklist

### Before Phase 1 Starts:
- [ ] Unit data Excel ready (173 units with all details)
- [ ] User list with roles and emails
- [ ] 8 business logic questions answered
- [ ] MySQL database running
- [ ] `JWT_SECRET` generated and set in `apps/api/.env`
- [ ] npm dependencies installed (`npm install`)
- [ ] Prisma schema pushed (`npm run db:push`)
- [ ] Dev servers start successfully (`npm run dev`)

### Phase 1 Deliverables (Basic Unit Grid):
- [ ] Unit grid UI with all 173 units
- [ ] Floor × unit matrix visualization
- [ ] Status color coding
- [ ] Filter bar (status, type, floor)
- [ ] Summary counters
- [ ] Unit detail modal
- [ ] API endpoints for units

### Phase 2-3 Planned:
- [ ] Contact/Lead management
- [ ] Sales pipeline automation
- [ ] Document management (SPA, Oqood)
- [ ] Payment tracking

### Phase 4-5 Planned:
- [ ] Commission calculations
- [ ] Reporting dashboards
- [ ] Multi-tower support

## 🚀 Getting Started Command

Once all items above are ready:

```bash
# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Fill in .env files with DATABASE_URL and JWT_SECRET

# Initialize database
npm run db:push

# Seed sample data (or import your unit data)
npm run db:seed

# Start development
npm run dev
```

Then open: http://localhost:5173

## 📞 Ready to Begin?

When checklist is complete, you have:

✅ Full-stack app running locally
✅ 173-unit Samha Tower in database
✅ Team users configured
✅ API endpoints ready
✅ Unit grid UI functional
✅ Business logic documented

**Next step**: Proceed with Phase 1 detailed implementation per 04-PHASE-1 document.

## Timeline Estimate

- **Setup & Preparation**: 1-2 days
- **Phase 1 (Unit Grid)**: 3-5 days
- **Phase 2 (Leads/Contacts)**: 4-6 days
- **Phase 3 (Pipeline)**: 5-7 days
- **Phase 4-5 (Commissions & Reports)**: 8-10 days

**Total MVP to Production**: 3-4 weeks (1 developer), 2 weeks (2 developers)

---

**Status**: Ready to start Phase 1? ☐ YES ☐ NO (complete checklist first)

Last updated: January 2024
