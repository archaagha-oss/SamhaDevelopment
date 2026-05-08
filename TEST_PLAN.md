# Phase 2: End-to-End Test Plan

## Critical Path Tests

### Test 1: Offer → Deal Integration
**Scenario:** Lead accepts offer, verify deal is auto-created with correct state

```
1. Create lead (email: test.buyer@example.com)
2. Create unit (Unit 1-01, price 850,000 AED)  
3. Create offer (offeredPrice: 850,000, no discount)
4. PATCH /offers/:id/status with { status: "ACCEPTED" }
5. Verify response contains { offer, deal }
6. Verify deal properties:
   - dealNumber matches pattern DEAL-\d{4}-\d{4}
   - stage = "RESERVATION_PENDING"
   - salePrice = 850,000
   - dldFee = 34,000 (4% of 850,000)
   - adminFee = 5,000
   - unitId matches offered unit
   - leadId matches offer lead
   - offerId links back to original offer
7. Verify unit status changed to ON_HOLD
8. Verify payment schedule generated (4-5 milestones)
```

**Expected Outcome:** Deal created with proper fee calculations, unit reserved, payment schedule ready

---

### Test 2: Payment → Stage Advancement (5% Milestone)
**Scenario:** Record first payment (5% deposit), verify deal auto-advances to RESERVATION_CONFIRMED

```
1. Start with deal in RESERVATION_PENDING stage
2. Payment milestones exist:
   - Milestone 1: 5% deposit = 42,500 AED
   - (other milestones...)
3. PATCH /payments/:id/paid with { paidDate, paymentMethod: "CASH" }
4. Verify response shows payment.status = "PAID"
5. Query deal and verify:
   - stage auto-advanced from RESERVATION_PENDING → RESERVATION_CONFIRMED
   - activity log shows "Deal auto-advanced... (4.99% paid)"
   - unit status = "RESERVED" (via side effect)
6. Verify lead.stage auto-updated to "CLOSED_WON"
```

**Critical:** With new fix, 42,500 / 850,000 = 5% calculated correctly

**Expected Outcome:** Deal progresses to next stage, unit locked, lead closes as WON

---

### Test 3: Payment → Stage Advancement (20% Milestone)
**Scenario:** Record more payments until 20% is reached, verify stage advances to SPA_PENDING

```
1. Current deal in RESERVATION_CONFIRMED
2. Record 2nd payment: 127,500 AED (15% of sale price)
3. Total paid now: 42,500 + 127,500 = 170,000 = 20% of 850,000
4. PATCH /payments/:id/paid for 2nd milestone
5. Verify deal stage auto-advances:
   - RESERVATION_CONFIRMED → SPA_PENDING (20% paid threshold)
6. Verify activity log shows auto-advancement
```

**Expected Outcome:** Stage advancement triggered by payment milestone percentage

---

### Test 4: Partial Payments Aggregate Correctly
**Scenario:** Record partial payments that sum to full amount

```
1. Payment exists: 42,500 AED (5% deposit), status = PENDING
2. POST /payments/:id/partial with { amount: 20,000 }
   - Creates partialPayment row
   - payment.status = "PARTIAL"
3. POST /payments/:id/partial with { amount: 22,500 }
   - Creates 2nd partialPayment row
   - totalPartialPaid = 42,500
   - payment.status auto-updates to "PAID"
4. Verify stage advancement triggered (same as full payment)
```

**Expected Outcome:** Partial payments aggregate correctly, full payment triggers stage advancement

---

### Test 5: Commission Unlock (SPA + Oqood Gate)
**Scenario:** Commission unlocks only when BOTH SPA signed AND Oqood registered

```
1. Deal created → commission.status = "NOT_DUE"
2. Move to SPA_SIGNED → commission.spaSignedMet = true
3. Commission still NOT_DUE (waiting for Oqood)
4. Move to OQOOD_REGISTERED → commission.oqoodMet = true
5. Verify commission.status = "PENDING_APPROVAL" (both gates met)
```

**Expected Outcome:** Commission gated on both conditions, unlocks only when both are true

---

## Test Execution Checklist

- [ ] Run existing deal lifecycle tests (vitest)
- [ ] Verify database migrations applied
- [ ] Test with real broker company (commission calculation)
- [ ] Test with broker agent → company resolution
- [ ] Verify activity logs comprehensive
- [ ] Check stage transition guards enforce correctly
- [ ] Verify payment percentage calculation with edge cases:
  - [ ] Sale price = 0 (returns 0%, no NaN)
  - [ ] Sale price with discount applied
  - [ ] DLD + admin fees as separate line items (not in %)
- [ ] Test concurrency: two payments marked paid simultaneously

---

## Success Criteria

✅ All tests pass  
✅ No data inconsistencies (offer accepted + deal created is atomic)  
✅ Payment percentage calculated correctly (only salePrice, not fees)  
✅ Stage advancement automatic and audit-logged  
✅ Commission gates work per spec  
✅ Unit status transitions correct  
✅ Lead closes as CLOSED_WON when unit reserved  

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Stage advancement checks cost DB query on every payment | Logged; acceptable for payment volume |
| Two payments create race condition on stage update | updateDealStage validates current stage, so 2nd call fails gracefully |
| Payment percentage changes if salePrice adjusted | Payment schedule immutable after deal created (by design) |
