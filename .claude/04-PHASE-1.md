# 04 — Phase 1: Foundation + Unit Inventory
**Duration: 4 weeks | Priority: HIGHEST**

---

## Goal

Replace Excel for unit tracking.
By end of this phase: every team member logs in, sees all 173 units in a live color-coded grid, changes statuses with history, and exports a summary — from any device.

---

## The One Question This Phase Answers

> "Which units are available right now, and who is interested in each one?"

No more calling each other to ask. No more version conflicts in Excel. One source of truth.

---

## Screens Built in Phase 1

### Screen 1 — Login
- Clerk-powered login (email + password)
- Role-aware redirect after login
- Users: 5 Samha team members

### Screen 2 — Unit Grid (Main Screen)
```
┌─────────────────────────────────────────────────────┐
│  SAMHA TOWER          Available: 128  Reserved: 12  │
│  Project switcher ▼   Booked: 3    Sold: 30  Blocked: 0 │
├─────────────────────────────────────────────────────┤
│  Filter: [All Types ▼] [All Status ▼] [All Floors ▼] │
├─────────────────────────────────────────────────────┤
│  Floor 20 │ [201]  [202]  [203]  [204]  [205]  [206] │
│  Floor 19 │ [191]  [192]  [193]  [194]  [195]  [196] │
│  ...                                                │
│  Floor 1  │ [101]  [102]  [103]  [104]  [105]       │
└─────────────────────────────────────────────────────┘

Color codes:
■ Green    = AVAILABLE
■ Yellow   = INTERESTED (someone expressed interest)
■ Orange   = RESERVED (5% paid)
■ Blue     = BOOKED (full booking payment paid)
■ Red      = SOLD (deal confirmed)
■ Gray     = BLOCKED
■ Dark     = HANDED_OVER
```

### Screen 3 — Unit Detail Drawer (slides in from right)
```
Unit 301 — 2BR | Floor 3 | 1,200 sqft
Sea View | Parking: Yes

Listed Price: AED 1,200,000
Service Charge: AED 12/sqft/yr

Status: AVAILABLE  [Change Status ▼]

Floor Plan: [View] [Download]

Status History:
  ● 15 Apr 2026 — AVAILABLE (initial)  by Admin

Interested Leads: (0)
  (none yet)

[Block Unit]  [Export Details]
```

### Screen 4 — Change Status Modal
```
Change Unit 301 Status
Current: AVAILABLE

New Status: [RESERVED ▼]

Reason (required for BLOCKED):
[                    ]

Linked Lead (optional):
[Search lead...      ]

[Confirm Change]
```

### Screen 5 — Export
- Excel download: all units with current status, floor, type, price, area

---

## Week-by-Week Tasks

### Week 1 — Foundation (Backend + Database)

**Day 1–2: Repo & Database**
- [ ] Create GitHub repository: `samha-crm`
- [ ] Initialize backend: `npm init`, Express, TypeScript
- [ ] Install Prisma, connect to Railway PostgreSQL
- [ ] Write Prisma schema: `Project`, `Unit`, `UnitStatusHistory`, `User`
- [ ] Run first migration: `npx prisma migrate dev`

**Day 3: Auth**
- [ ] Install Clerk SDK (backend + frontend)
- [ ] Protect all API routes with auth middleware
- [ ] Create 5 user accounts for Samha team
- [ ] Map Clerk roles to app roles (ADMIN, SALES, OPERATIONS, etc.)

**Day 4: Seed Data**
- [ ] Write `prisma/seed.ts`
- [ ] Import 173 units from Samha's Excel file
- [ ] Seed 1 project: "Samha Tower"
- [ ] Verify all units load correctly in DB

**Day 5: Unit API**
- [ ] `GET /api/projects/:id/units` — returns all units grouped by floor
- [ ] `GET /api/units/:id` — single unit with status history
- [ ] `PATCH /api/units/:id/status` — change status through service layer
- [ ] Unit service: transition validation + history write
- [ ] Deploy backend to Railway

---

### Week 2 — Unit Grid UI

**Day 6–7: Project Setup & Grid**
- [ ] Initialize React + Vite frontend
- [ ] Install Tailwind CSS, TanStack Query, Zustand, Clerk React
- [ ] Build `UnitGrid.tsx` — floor × column matrix layout
- [ ] Color-coded `UnitCard.tsx` component per status
- [ ] Connect to API: `useUnits` hook with React Query

**Day 8: Filters & Summary**
- [ ] Filter bar: type, status, floor, view direction
- [ ] Summary counters: Available / Reserved / Booked / Sold / Blocked
- [ ] Real-time filter (no page reload — client-side filter of loaded data)

**Day 9–10: Unit Drawer**
- [ ] Slide-in `UnitDrawer.tsx` on unit click
- [ ] Show: unit specs, listed price, area, view, parking
- [ ] Status badge with color
- [ ] Status history timeline (chronological)
- [ ] Floor plan image display (from R2 signed URL)
- [ ] Count of interested leads (Phase 2 will populate this — show 0 for now)

---

### Week 3 — Unit Management

**Day 11–12: Status Change Flow**
- [ ] "Change Status" button in drawer → opens modal
- [ ] Status dropdown shows only valid next states (from transition map)
- [ ] Reason field (required for BLOCKED)
- [ ] Optional lead name link (free text for now — full lead link in Phase 2)
- [ ] Confirmation → API call → drawer refreshes
- [ ] History entry appears immediately

**Day 13: Block / Unblock**
- [ ] Block unit: ADMIN only, mandatory reason
- [ ] Unblock unit: ADMIN only, confirmation
- [ ] Blocked units visually distinct in grid (gray + lock icon)

**Day 14: RBAC**
- [ ] SALES: can mark INTERESTED and RESERVED only
- [ ] OPERATIONS: can mark BOOKED
- [ ] ADMIN: all transitions including BLOCKED
- [ ] FINANCE / READONLY: view only
- [ ] UI hides actions user doesn't have permission for

**Day 15: Interested Leads Preview**
- [ ] Store interested lead names against unit (temporary — Phase 2 replaces with full lead model)
- [ ] Unit drawer shows: "2 people interested: Ahmed, Sara"

---

### Week 4 — Polish & Go Live

**Day 16–17: Mobile Responsive**
- [ ] Grid scrolls horizontally on mobile
- [ ] Drawer becomes full-screen sheet on mobile
- [ ] Touch-friendly buttons (min 44px tap targets)
- [ ] Test on iPhone and Android

**Day 18: Export**
- [ ] "Export Units" button → downloads Excel
- [ ] Columns: Unit No, Floor, Type, Area, Price, View, Parking, Status
- [ ] Filtered export (export only what's currently filtered)

**Day 19: Notifications (Basic)**
- [ ] In-app notification when a unit status changes
- [ ] All SALES + ADMIN users see: "Unit 301 reserved by [user]"
- [ ] Notification bell in navbar with unread count

**Day 20: Go Live**
- [ ] Load all 173 real units from Samha's data
- [ ] Team walkthrough session
- [ ] Document known issues
- [ ] Mark Excel sheet as retired

---

## API Endpoints for Phase 1

```
GET    /api/projects                           # list projects
GET    /api/projects/:id/units                 # all units with floor grouping
GET    /api/units/:id                          # unit detail + history
PATCH  /api/units/:id/status                   # change status
POST   /api/units/:id/block                    # block with reason (ADMIN)
POST   /api/units/:id/unblock                  # unblock (ADMIN)
GET    /api/units/export                       # download Excel

GET    /api/users/me                           # current user profile
```

---

## Data Needed from Samha Before Week 1

**Unit Data Sheet (required for seed.ts)**

Excel with these columns:
```
Unit Number | Floor | Type | Area (sqft) | Listed Price (AED) | View | Parking | Current Status
    301     |   3   |  2BR |   1200      |     1,200,000      | Sea  |   Yes   |   AVAILABLE
    302     |   3   |  1BR |    850      |       900,000      | City |   No    |   SOLD
    ...
```

For SOLD units, also provide: buyer first name (for the interested leads preview)

**User List:**
```
Name | Email | Role
Mohamed | m@samha.ae | ADMIN
Sara | s@samha.ae | SALES
...
```

**Floor plan images (optional for Week 1, can add later):**
- PDF or PNG per unit type (1BR, 2BR, studio, etc.)

---

## Phase 1 Definition of Done

- [ ] All 173 units visible in grid with correct data
- [ ] Unit status changes work and write history
- [ ] BLOCKED requires reason + ADMIN role
- [ ] Status history visible in drawer
- [ ] Filter by type, status, floor works
- [ ] Summary counters accurate
- [ ] Export to Excel works
- [ ] Works on mobile browser
- [ ] All 5 users can log in with correct roles
- [ ] Deployed to live Railway URL (not localhost)
- [ ] Team tested and signed off

**When all boxes are checked, Phase 2 begins.**
