# Money columns: Float → Decimal(15, 2)

> Audit Critical #1. This file describes how to actually flip the schema once
> the production database has run the migration in
> `prisma/migrations/manual/2026-05-09_money_to_decimal.sql`.

## Why

Prisma's `Float` maps to MySQL `DOUBLE`, which uses IEEE 754 binary
floating-point. Currency arithmetic on `DOUBLE` accumulates fractional-cent
drift across commission/payment pipelines:

```js
0.1 + 0.2 === 0.3  // false → 0.30000000000000004
```

`DECIMAL(15, 2)` stores money exactly with 13 digits left of the decimal —
plenty for AED real-estate amounts up to ~9.9 trillion.

## Phase 1 — landed on this branch

- [x] Manual SQL migration file at
  `prisma/migrations/manual/2026-05-09_money_to_decimal.sql`
- [x] `installDecimalJsonSerialization()` patches `Decimal.prototype.toJSON`
  so JSON responses keep emitting plain numbers. The web app does **not**
  need changes for the wire format. Wired into `src/index.ts` boot.
- [x] No schema change yet. Prisma client still returns `number` for these
  columns until Phase 2 runs.

## Phase 2 — to be run together (do not stagger)

1. **Backup the database.** Money migrations are not reversible mid-deploy
   without restoring from snapshot.

2. **Run the SQL** against staging first, then production:
   ```sh
   mysql -u $DB_USER -p $DB_NAME \
     < apps/api/prisma/migrations/manual/2026-05-09_money_to_decimal.sql
   ```
   The `MODIFY COLUMN` statements are online for InnoDB on MySQL 8 — they
   lock the table briefly per statement but do not require a full rebuild.

3. **Flip the schema columns** in `apps/api/prisma/schema.prisma` (24 fields,
   listed in the SQL header). Each `Float` becomes:
   ```
   <field>  Decimal  @db.Decimal(15, 2) [NOT NULL etc as before]
   ```

4. **Regenerate the client**:
   ```sh
   npx prisma generate --schema apps/api/prisma/schema.prisma
   ```

5. **Fix the call sites tsc complains about.** The hot ones, in priority
   order (these contain the arithmetic that motivated the migration):

   - `src/services/paymentService.ts` — installment math
   - `src/services/commissionService.ts` — `amount * rate / 100` etc.
   - `src/services/dealService.ts` — sale price + discount + fee adds
   - `src/services/financeService.ts` — dashboard aggregates
   - `src/routes/finance.ts` — Sums passed to recharts
   - `src/routes/commissions.ts` — uses Number(commission.amount) on
     line 168 (already future-proofed in the Critical-batch commit)
   - `src/services/excelService.ts` — report generation

   Pattern. Replace plain arithmetic:
   ```ts
   const total = payment.amount + payment.lateFee;       // ❌
   ```
   with one of:
   ```ts
   import { Prisma } from "@prisma/client";
   const total = new Prisma.Decimal(payment.amount).plus(payment.lateFee);
   // OR, when you only need a JS number for further math/JSON:
   const total = Number(payment.amount) + Number(payment.lateFee);
   ```
   `Number(decimal)` is exact for values ≤ Number.MAX_SAFE_INTEGER, which
   covers AED amounts.

6. **Verify**:
   - `npx tsc --noEmit -p apps/api/tsconfig.json`
   - `npm test --prefix apps/api`
   - Hit `/api/finance/summary`, `/api/commissions/...` and confirm JSON
     numbers are still numbers (the serializer makes this transparent).

## Columns intentionally NOT migrated

These stay `Float` because they are percentages or physical measurements,
not money:

| Model            | Field(s) |
|------------------|----------|
| ProjectConfig    | dldPercent, vatPercent, agencyFeePercent, lateFeeMonthlyPercent, delayCompensationAnnualPercent, delayCompensationCapPercent, liquidatedDamagesPercent, disposalThresholdPercent, defaultArea |
| Unit             | area, internalArea, externalArea, areaSqft, ratePerSqft |
| BrokerCompany    | commissionRate |
| Offer            | discountPct |
| Milestone        | percentage |
| Deal             | commissionRateOverride |
| DealJointOwner   | ownershipPercentage |
| Payment          | percentage |
| Commission       | rate |
| PricingRule      | adjustmentValue (mode-dependent — encode interpretation in code) |

## Rollback

If Phase 2 is in flight and a bug appears, the safest rollback is:

1. Revert the code commit (Phase 2 commit).
2. Run an inverse SQL that flips DECIMAL(15,2) back to DOUBLE — there is
   no precision loss going DECIMAL → DOUBLE for values inside the range
   already discussed.
3. Restore from the Phase-1 backup if anything else looks off.
