-- ON_CONSTRUCTION_PCT payment trigger wiring.
--
-- Extends the existing MilestoneTrigger enum with a new value
-- (ON_CONSTRUCTION_PCT) and adds a `constructionPercent` threshold column to
-- both PaymentPlanMilestone (template) and Payment (materialized). When the
-- project's overall construction-progress percent crosses a payment's
-- threshold, the payment's dueDate is set to today (handled in
-- constructionService.updateMilestone).
--
-- Idempotent: safe to re-run. Uses the standard stored-procedure pattern
-- (matches 2026-05-10_commission_documentkey.sql).

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN tbl VARCHAR(64),
  IN col VARCHAR(64),
  IN col_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = tbl
      AND column_name = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- Extend the MilestoneTrigger enum. MySQL stores ENUMs inline on each column
-- that references the type, so we modify each column individually. The MODIFY
-- COLUMN is itself idempotent — it always rewrites to the supplied
-- definition, so re-running just no-ops.
DROP PROCEDURE IF EXISTS extend_milestone_trigger_enum$$
CREATE PROCEDURE extend_milestone_trigger_enum(
  IN tbl VARCHAR(64),
  IN col VARCHAR(64),
  IN col_default VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = tbl
      AND column_name = col
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', tbl, '` MODIFY COLUMN `', col, '` ',
      'ENUM(',
        '''DAYS_FROM_RESERVATION'',',
        '''FIXED_DATE'',',
        '''ON_SPA_SIGNING'',',
        '''ON_OQOOD'',',
        '''ON_HANDOVER'',',
        '''ON_CONSTRUCTION_PCT''',
      ') NOT NULL DEFAULT ''', col_default, ''''
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL extend_milestone_trigger_enum('PaymentPlanMilestone', 'triggerType',     'DAYS_FROM_RESERVATION');
CALL extend_milestone_trigger_enum('Payment',              'scheduleTrigger', 'DAYS_FROM_RESERVATION');

CALL add_column_if_missing('PaymentPlanMilestone', 'constructionPercent', 'INT NULL');
CALL add_column_if_missing('Payment',              'constructionPercent', 'INT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS extend_milestone_trigger_enum;

-- Verification (optional — run manually):
-- SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.columns
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('PaymentPlanMilestone', 'Payment')
--   AND COLUMN_NAME IN ('triggerType', 'scheduleTrigger', 'constructionPercent');
