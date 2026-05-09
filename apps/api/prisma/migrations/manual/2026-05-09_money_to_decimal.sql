-- ============================================================
-- Money columns: Float → DECIMAL(15, 2)
-- ============================================================
-- Audit Critical #1: floating-point arithmetic on currency amounts
-- silently rounds and accumulates fractional-cent drift through
-- commission / payment / refund pipelines. This migration moves every
-- *money* column (not areas, not percentages) to DECIMAL(15, 2), which
-- is the conventional money width for retail real-estate amounts up
-- to 9,999,999,999,999.99.
--
-- ROLLOUT ORDER (do not deviate):
--   1. Take a database backup.
--   2. Apply this SQL to the target database.
--   3. Update apps/api/prisma/schema.prisma — flip the listed columns
--      from `Float` to `Decimal @db.Decimal(15, 2)`.
--   4. Run `npx prisma generate --schema apps/api/prisma/schema.prisma`.
--   5. tsc will surface arithmetic call sites that need .toNumber() or
--      Decimal helpers — fix them per MONEY_TYPE_MIGRATION.md.
--   6. Deploy code.
--
-- Columns intentionally LEFT as Float because they are percentages or
-- physical measurements, not money:
--   ProjectConfig.dldPercent / vatPercent / agencyFeePercent /
--     lateFeeMonthlyPercent / delayCompensationAnnualPercent /
--     delayCompensationCapPercent / liquidatedDamagesPercent /
--     disposalThresholdPercent / defaultArea
--   Unit.area / internalArea / externalArea / areaSqft / ratePerSqft
--   Lead none (budget IS money — see below)
--   BrokerCompany.commissionRate
--   Offer.discountPct
--   Milestone.percentage
--   Deal.commissionRateOverride
--   DealJointOwner.ownershipPercentage
--   Payment.percentage
--   Commission.rate
--   PricingRule.adjustmentValue (mode-dependent — keep Float; encode
--     the absolute-vs-percentage interpretation client-side)
--
-- ============================================================

-- ProjectConfig — admin/admin-default fees and default unit price
ALTER TABLE `ProjectConfig`
  MODIFY COLUMN `adminFee`            DECIMAL(15, 2) NOT NULL DEFAULT 5000.00,
  MODIFY COLUMN `defaultPrice`        DECIMAL(15, 2)     NULL,
  MODIFY COLUMN `resaleProcessingFee` DECIMAL(15, 2) NOT NULL DEFAULT 3000.00;

-- Unit — list and asking prices (areas stay Float — see header)
ALTER TABLE `Unit`
  MODIFY COLUMN `basePrice` DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `price`     DECIMAL(15, 2) NOT NULL;

-- Lead — buyer budget
ALTER TABLE `Lead`
  MODIFY COLUMN `budget` DECIMAL(15, 2) NULL;

-- Offer — pricing
ALTER TABLE `Offer`
  MODIFY COLUMN `offeredPrice`   DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `originalPrice`  DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

-- Deal — sale price + transactional fees
ALTER TABLE `Deal`
  MODIFY COLUMN `salePrice`         DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `discount`          DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `reservationAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `dldFee`            DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `adminFee`          DECIMAL(15, 2) NOT NULL DEFAULT 5000.00;

-- Payment — installment amounts
ALTER TABLE `Payment`
  MODIFY COLUMN `amount`         DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `originalAmount` DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `adjustedAmount` DECIMAL(15, 2)     NULL;

-- PartialPayment — recorded part-payments against an installment
ALTER TABLE `PartialPayment`
  MODIFY COLUMN `amount` DECIMAL(15, 2) NOT NULL;

-- Commission — broker commission amount + actually-paid amount
ALTER TABLE `Commission`
  MODIFY COLUMN `amount`     DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `paidAmount` DECIMAL(15, 2)     NULL;

-- LateFeeRule — fee schedule
ALTER TABLE `LateFeeRule`
  MODIFY COLUMN `feeAmount`    DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `maxFeeAmount` DECIMAL(15, 2)     NULL;

-- UnitPriceHistory — audit trail of unit price changes
ALTER TABLE `UnitPriceHistory`
  MODIFY COLUMN `oldPrice` DECIMAL(15, 2) NOT NULL,
  MODIFY COLUMN `newPrice` DECIMAL(15, 2) NOT NULL;
