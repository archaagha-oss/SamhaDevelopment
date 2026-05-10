-- Closes audit gap #7. Add Commission.documentKey for the Form A
-- (or equivalent commission-authorization doc) — required by the
-- APPROVED → PAID transition gate at routes/commissions.ts.
--
-- Idempotent: safe to re-run.

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

DELIMITER ;

CALL add_column_if_missing('Commission', 'documentKey', 'VARCHAR(500) NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;
