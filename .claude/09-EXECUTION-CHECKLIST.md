# 09 — Execution Checklist
**What Samha Needs to Prepare Before Development Starts**

---

## Before Phase 1 (Week 1 — Needed Immediately)

### ✅ 1. Unit Data Sheet
**What:** Excel file with all 173 units
**Format:**
```
Unit Number | Floor | Type        | Area (sqft) | Listed Price (AED) | View   | Parking | Status
301         | 3     | 2BR         | 1200        | 1,200,000          | Sea    | Yes     | AVAILABLE
302         | 3     | 1BR         | 850         | 900,000            | City   | No      | SOLD
101         | 1     | COMMERCIAL  | 2000        | 2,500,000          | Street | No      | AVAILABLE
```
**Status values to use:** AVAILABLE / SOLD / RESERVED / BOOKED / BLOCKED
**Who prepares this:** Whoever manages the current Excel sheet
**Time to prepare:** 1–2 hours

---

### ✅ 2. Team User List
**What:** Names, emails, and roles for the 5 team members
**Format:**
```
Name              | Email              | Role
Mohamed Al-X      | m@samha.ae         | ADMIN
Sara Al-Y         | s@samha.ae         | SALES
Ahmed Al-Z        | a@samha.ae         | OPERATIONS
Fatima Al-W       | f@samha.ae         | FINANCE
Khalid Al-V       | k@samha.ae         | SALES
```
**Roles available:** ADMIN / SALES / OPERATIONS / FINANCE / READONLY

---

### ✅ 3. Domain / Hosting Preference (Optional)
**What:** Do you want a custom domain? e.g. `crm.samhadevelopment.ae`
If yes: provide domain registrar access to configure DNS
If no: Railway provides a URL like `samha-crm.up.railway.app`

---

## Before Phase 2 (Week 5 — Needed 1 Week Before)

### ✅ 4. Active Broker Company List
**What:** All broker companies currently working with Samha
**Format:**
```
Company Name            | RERA License No | Expiry     | Commission Rate | Main Contact
Dubai Homes Real Estate | BRN-12345       | 01/09/2026 | 4%              | Khalid +971 50 XXX
Al Waha Properties      | BRN-67890       | 03/10/2026 | 4%              | Sara +971 55 XXX
```
**Also:** For each company, list all agents who have brought leads, with their phone numbers and RERA card numbers if available.

---

### ✅ 5. WhatsApp Business Number
**What:** A dedicated WhatsApp Business number for Samha (different from personal phones)
**Why:** 360dialog connects to one number — outgoing WhatsApp messages come from this number
**Note:** This number must be registered with Meta Business Manager
**If you don't have one:** We can set up a new SIM with a Samha number

---

## Before Phase 3 (Week 9 — Needed 1 Week Before)

### ✅ 6. Payment Plan Templates
**What:** All current payment plans Samha offers
**For each plan, describe:**
- Plan name (e.g. "30/70 Standard")
- Each installment: what percentage, when it's due, what triggers it
**Example:**
```
Plan: 30/70 Standard
Step 1: 5% — On booking (non-refundable)
Step 2: 4% — On booking (DLD fee)
Step 3: AED 5,000 — On booking (admin fee)
Step 4: 15% — Within 30 days of booking
Step 5: 10% — On structure completion
Step 6: 70% — On handover (December 2026)
```
**Note:** Include all plan variations (bulk/cash discount, different splits)

---

### ✅ 7. Existing Sold/Reserved Units Data (30 units)
**What:** For the 30 already-sold/reserved units, provide whatever you have:
- Buyer name, phone, nationality
- Unit number, sale price
- Which payment plan
- Payments received so far (amounts + dates + method)
- Documents available (SPA signed? Oqood done?)
- Broker company + agent (if applicable)

**Why:** To seed the system with real historical data so everything is in one place from day one
**Format:** Any format — Excel, scanned PDFs, even written notes — we'll clean and import it

---

### ✅ 8. Document Templates
**What:** Your current templates (Word or PDF):
1. Sales Offer letter
2. Reservation Form
3. SPA (Sale and Purchase Agreement)

**Why:** These become the auto-filled PDFs the app generates
**Note:** Provide in editable format (Word preferred) — we'll convert to code templates

---

### ✅ 9. Company Logo + Branding
**What:** Samha Development logo (PNG/SVG, high resolution)
**Also:** Brand colors if you have them (primary color HEX code)
**Why:** Used in all generated PDF documents and the app header

---

## Before Phase 4 (Week 14 — Needed 1 Week Before)

### ✅ 10. Complete Broker Agent List
**What:** Individual agents at each broker company who have interacted with Samha
**For each agent:**
```
Company             | Agent Name     | Phone          | RERA Card No | Card Expiry
Dubai Homes RE      | Khalid         | +971 50 XXX    | 54321        | 06/2027
Dubai Homes RE      | Sara Johnson   | +971 55 XXX    | 67890        | 03/2027
Al Waha Properties  | Omar           | +971 52 XXX    | 11111        | 09/2026
```

---

## Questions to Answer Before Development Starts

The following are business logic decisions that will affect how the system is built:

**Q1: Can a customer reserve a unit without paying the 5% immediately?**
(Or does reservation always require payment first?)

**Q2: Can two staff members assign the same unit to two different leads at the same time?**
(We'll allow "interested" for multiple leads but only one can "reserve" — confirm this is correct)

**Q3: What happens if a buyer wants to switch units after reservation but before SPA?**
(Cancel first deal, release unit, create new deal? Or is there a "transfer" process?)

**Q4: Is the 4% DLD always paid by the buyer, or can it sometimes be covered by the developer?**
(Affects whether DLD amount is always added to payment schedule or can be zero)

**Q5: Can a discount ever affect the DLD fee calculation?**
(DLD is 4% of official sale price — discounts are usually not reflected on the official contract. Confirm how you handle this)

**Q6: How many payment plan templates do you currently use?**
(So we can seed them all correctly before Phase 3)

**Q7: Who approves commissions internally — one person or multiple?**
(Affects whether commission approval requires one or two signatures)

**Q8: Do you want automatic WhatsApp messages to buyers when payment is overdue?**
(Or only to staff? Some developers prefer not to auto-message buyers directly)

---

## Development Start Checklist

```
□ Unit Data Sheet prepared (173 units Excel)
□ User list ready (5 team members + roles)
□ GitHub account ready (or we create one)
□ Railway account created (free tier to start)
□ Answers to Questions Q1–Q8 provided
□ Domain preference confirmed
```

**When these 6 items are ready → Phase 1 development begins immediately.**

Estimated time from "ready" to Phase 1 live URL: **5 business days.**
