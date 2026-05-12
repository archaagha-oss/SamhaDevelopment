-- Lead KYC / AML profile columns. Closes the gap surfaced by the LeadKycTab
-- redesign: file-level KYC docs (Document.expiryDate) cover doc expiry,
-- but per-person AML data (DOB, PEP, risk, occupation, residency) had no home.
--
-- Idempotent: every ADD COLUMN is wrapped in a stored procedure that checks
-- INFORMATION_SCHEMA so re-running the file is a no-op. Same pattern as
-- 2026-05-10_perf_indexes.sql.
--
-- All columns are nullable (or have defaults) so existing rows are unaffected.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN tbl  VARCHAR(64),
  IN col  VARCHAR(64),
  IN ddl  TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = tbl
      AND column_name = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', ddl);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL add_column_if_missing('Lead', 'dateOfBirth',     'DATETIME(3) NULL');
CALL add_column_if_missing('Lead', 'pepFlag',         'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_column_if_missing('Lead', 'riskRating',      'VARCHAR(191) NULL');
CALL add_column_if_missing('Lead', 'occupation',      'VARCHAR(191) NULL');
CALL add_column_if_missing('Lead', 'residencyStatus', 'VARCHAR(191) NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- Verification (optional):
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
-- FROM information_schema.columns
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Lead'
--   AND COLUMN_NAME IN ('dateOfBirth','pepFlag','riskRating','occupation','residencyStatus');
