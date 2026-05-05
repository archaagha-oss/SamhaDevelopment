# 05 — Phase 2: Leads + Communication Hub
**Duration: 4 weeks | Depends on: Phase 1 complete**

---

## Goal

Every lead is logged, every follow-up is tracked, every communication has a record.
No lead goes cold silently. The team wakes up every day knowing exactly what needs attention.

---

## The One Question This Phase Answers

> "Who called about which unit, when did we last speak to them, and what needs to happen next?"

---

## New Screens in Phase 2

### Screen 6 — Leads List
- Table view: Name, Phone, Source, Interested Unit, Status, Last Activity, Assigned To
- Kanban view: pipeline columns (NEW → CONTACTED → OFFER_SENT → SITE_VISIT → NEGOTIATING)
- Quick filters: my leads, by stage, by source (broker/direct), by project
- Search by name or phone
- "+ New Lead" button

### Screen 7 — Lead Profile
```
Ahmed Al Mansouri  |  +971 50 123 4567  |  Emirati
Source: BROKER  →  Dubai Homes Real Estate (Khalid - agent)
Assigned to: Sara
Status: OFFER_SENT  [Change Stage ▼]

Interested Units:
  ■ Unit 301 — 2BR Sea View — AED 1,200,000  [Primary]
  ■ Unit 502 — 2BR City View — AED 1,100,000

─── Activity Timeline ─────────────────────────────
  ● 15 Apr | CALL (12 min) — Sara
    "Interested in 2BR with sea view. Budget ~1.2M. Will decide after site visit"
    Follow up: 18 Apr

  ● 13 Apr | WHATSAPP — Sara
    "Sent brochure and floor plan for Unit 301"

  ● 12 Apr | NOTE — Mohamed
    "Referred by Dubai Homes. High intent buyer."

[Log Activity ▼]  [Send Offer PDF]  [Reserve Unit]  [Mark Lost]
```

### Screen 8 — Log Activity Modal
```
Log Activity for Ahmed Al Mansouri

Type: [Call ▼]
Summary: [                                    ]
Outcome: [                                    ]
Call Duration: [    ] minutes
Next Follow-up Date: [15/04/2026]

[Save Activity]
```

### Screen 9 — New Lead Form
```
First Name: [        ]  Last Name: [        ]
Phone: [+971          ]  Email: [           ]
Nationality: [        ]

Source: [BROKER ▼]
  → Broker Company: [Search company...  ]
  → Broker Agent: [Search agent...      ]

Interested Unit(s): [Search unit number... + Add]
Budget: [AED           ]
Assigned To: [Sara ▼]
Notes: [                                        ]

[Save Lead]
```

### Screen 10 — Tasks List
- My tasks today / this week / overdue
- Filter by entity (lead, deal, broker)
- Quick complete checkbox
- Create task button

---

## Week-by-Week Tasks

### Week 5 — Lead Core

**Day 21–22: Lead Database + API**
- [ ] Add Prisma models: `Lead`, `LeadUnitInterest` (new migration)
- [ ] CRUD API: `POST /leads`, `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id`
- [ ] Duplicate detection: reject if phone already exists, show existing lead
- [ ] `POST /leads/:id/interests` — link unit(s) to lead
- [ ] Unit grid update: show interested lead count per unit (via join)

**Day 23–24: Lead List UI**
- [ ] Lead list table with sorting + pagination
- [ ] Quick filters: stage, source, assigned to, project
- [ ] Search by name or phone
- [ ] Status badge per stage
- [ ] Click row → lead profile page

**Day 25: Lead Profile + New Lead Form**
- [ ] Lead profile page: all fields, assigned staff, broker agent link
- [ ] Interested units section (add/remove units)
- [ ] New lead form with broker agent search
- [ ] Stage change dropdown with confirmation

---

### Week 6 — Activity Logging

**Day 26–27: Activity API + Timeline**
- [ ] `POST /leads/:id/activities` — log call, WhatsApp, email, meeting, note
- [ ] `GET /leads/:id/activities` — chronological timeline
- [ ] Activity model: structured fields per type (callDuration, meetingLocation, etc.)
- [ ] Auto-log activity when lead stage changes (stage_change type)

**Day 28: Activity UI**
- [ ] Timeline component on lead profile
- [ ] Log Activity modal: type-aware form (shows callDuration only for calls, etc.)
- [ ] Activity icons per type
- [ ] "Follow-up date" field per activity → creates task automatically

**Day 29–30: Unit ↔ Lead Connection**
- [ ] Unit drawer now shows: full list of interested leads with names + last contact date
- [ ] Click lead name in unit drawer → navigate to lead profile
- [ ] Lead profile unit cards show unit status live

---

### Week 7 — WhatsApp + Tasks

**Day 31–32: WhatsApp Integration**
- [ ] Connect 360dialog WhatsApp Business API
- [ ] "Send WhatsApp" button on lead profile
- [ ] Message templates: brochure share, follow-up, offer sent
- [ ] Sent message auto-logged as WHATSAPP activity with messageId
- [ ] Incoming WhatsApp replies tracked (webhook from 360dialog)

**Day 33–34: Task System**
- [ ] Add Prisma model: `Task` (new migration)
- [ ] `POST /tasks`, `GET /tasks/mine`, `PATCH /tasks/:id/complete`
- [ ] Task creation from follow-up date on activities
- [ ] Auto-task: "First contact within 24h" on new lead creation
- [ ] Auto-task: "Send offer" when stage → OFFER_SENT
- [ ] Task list UI: sorted by due date, overdue highlighted

**Day 35: Sales Offer PDF**
- [ ] React-PDF template for sales offer
- [ ] Pre-filled from: unit specs, price, selected payment plan summary, Samha branding
- [ ] "Send Offer" button on lead profile → generates PDF → opens email/WhatsApp share
- [ ] Activity auto-logged: "Sales offer sent"

---

### Week 8 — Notifications + Digest

**Day 36–37: In-App Notifications**
- [ ] Add Prisma model: `Notification`
- [ ] Notification bell in navbar with unread count
- [ ] Notifications fire for: new lead assigned, unit reserved, task overdue
- [ ] Mark as read / mark all read

**Day 38: Daily Digest Email**
- [ ] `dailyDigest.job.ts` — runs 8am UAE time
- [ ] Per user email: tasks due today, overdue tasks, leads needing follow-up
- [ ] Email template via Resend + React Email

**Day 39–40: Polish + Kanban View**
- [ ] Kanban board for leads pipeline (drag card to change stage)
- [ ] Mobile-friendly lead profile
- [ ] Test full flow: new lead → log calls → send offer → reserve unit → unit status updates

---

## API Endpoints for Phase 2

```
# Leads
GET    /api/leads                              # list with filters
POST   /api/leads                              # create (duplicate check)
GET    /api/leads/:id                          # profile + interests + activities
PATCH  /api/leads/:id                          # update lead
PATCH  /api/leads/:id/stage                    # change stage
DELETE /api/leads/:id                          # soft delete

POST   /api/leads/:id/interests                # add unit interest
DELETE /api/leads/:id/interests/:unitId        # remove unit interest
GET    /api/leads/:id/activities               # activity timeline
POST   /api/leads/:id/activities               # log activity

# Broker Companies + Agents
GET    /api/broker-companies                   # list for search dropdowns
POST   /api/broker-companies
GET    /api/broker-companies/:id
POST   /api/broker-companies/:id/agents
GET    /api/broker-companies/:id/agents

# Tasks
GET    /api/tasks/mine                         # current user tasks
POST   /api/tasks
PATCH  /api/tasks/:id
PATCH  /api/tasks/:id/complete

# Notifications
GET    /api/notifications                      # current user notifications
PATCH  /api/notifications/read-all
PATCH  /api/notifications/:id/read

# WhatsApp
POST   /api/whatsapp/send                      # send to lead
POST   /api/whatsapp/webhook                   # receive incoming messages
```

---

## Phase 2 Definition of Done

- [ ] Leads can be created with broker agent assignment
- [ ] Duplicate phone detection works
- [ ] Activity timeline logs calls, WhatsApp, email, meetings, notes
- [ ] Interested units linked to leads; unit grid shows counts
- [ ] WhatsApp message sent from app + logged as activity
- [ ] Tasks created from follow-up dates and auto-triggers
- [ ] Sales offer PDF generated and logged when sent
- [ ] Daily digest email received by each user at 8am
- [ ] In-app notifications fire on new lead + stage change
- [ ] Kanban pipeline view functional
- [ ] Mobile responsive

**When all boxes are checked, Phase 3 begins.**
