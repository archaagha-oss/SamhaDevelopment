# Samha Development CRM — Document Index
**Version 3.0 | April 2026 | Full Stack Development Plan**

---

## Document Set

| File | Contents |
|---|---|
| `00-INDEX.md` | This file — overview and navigation |
| `01-PRODUCT.md` | Product definition, business logic, core rules |
| `02-DATA-MODELS.md` | Complete database schema, all tables, all relationships |
| `03-ARCHITECTURE.md` | Tech stack, folder structure, backend patterns, event system |
| `04-PHASE-1.md` | Foundation + Unit Inventory — execution ready |
| `05-PHASE-2.md` | Leads + Communication Hub |
| `06-PHASE-3.md` | Deals + Payments + Contracts |
| `07-PHASE-4.md` | Broker Management |
| `08-PHASE-5.md` | Reporting + Multi-Tower Scale |
| `09-EXECUTION-CHECKLIST.md` | What you need to prepare before starting |

---

## The Five Problems This App Solves

1. No single source of truth for unit availability → **Phase 1**
2. Leads and broker follow-ups fall through the cracks → **Phase 2**
3. Payment collection is manual, nothing reminds anyone → **Phase 3**
4. Contracts and deadlines are tracked in emails and files → **Phase 3**
5. Broker companies and their agents are not properly separated or tracked → **Phase 4**

---

## Broker Model Correction (Important)

A **Broker** in this system is always a **company** (registered with RERA).
A **Broker Agent** is the individual person at that company who manages the lead.

- One broker company → many agents
- A lead is assigned to a broker agent, which belongs to a broker company
- Commission is owed to the broker company
- Commission is triggered only after SPA is signed AND Oqood is registered
- Commission cannot be marked as approved until both conditions are verified in the system

---

## Total Timeline

| Phase | Scope | Duration |
|---|---|---|
| Phase 1 | Unit Inventory | 4 weeks |
| Phase 2 | Leads + Communication | 4 weeks |
| Phase 3 | Deals + Payments + Contracts | 5 weeks |
| Phase 4 | Broker Management | 3 weeks |
| Phase 5 | Reporting + Multi-Tower | 3 weeks |
| **Total** | | **~19 weeks** |

---

## Monthly Running Cost

| Service | Cost/Month |
|---|---|
| Railway (hosting + PostgreSQL) | ~$20 |
| Cloudflare R2 (file storage) | ~$5 |
| Resend (email) | Free to 3,000/mo |
| 360dialog (WhatsApp API) | ~$50–80 |
| Documenso (e-sign, self-hosted) | $0 |
| Clerk (auth) | Free to 10,000 users |
| **Total** | **~$75–105/month** |

You own the code. No per-seat fees. Scales to 10 towers for the same cost.
