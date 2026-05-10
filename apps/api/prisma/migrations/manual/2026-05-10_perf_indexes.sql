-- Performance indexes — closes audit P1 E.1.3.
--
-- Each CREATE INDEX is wrapped in a stored-procedure check so the migration
-- is idempotent (running it twice is a no-op). MySQL/MariaDB does not have
-- CREATE INDEX IF NOT EXISTS pre-8.0.29 / pre-10.5, so we use this pattern.
--
-- Targets the slow paths surfaced by load testing and static analysis:
--   - Lead.source / Lead.createdAt / Lead.(assignedAgentId, stage)
--   - Deal.createdAt / Deal.(stage, createdAt) / Deal.(leadId, isActive)

DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_missing$$
CREATE PROCEDURE add_index_if_missing(
  IN tbl VARCHAR(64),
  IN idx VARCHAR(128),
  IN cols TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = tbl
      AND index_name = idx
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` (', cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- Lead
CALL add_index_if_missing('Lead', 'Lead_source_idx',                 '`source`');
CALL add_index_if_missing('Lead', 'Lead_createdAt_idx',              '`createdAt`');
CALL add_index_if_missing('Lead', 'Lead_assignedAgentId_stage_idx',  '`assignedAgentId`, `stage`');

-- Deal
CALL add_index_if_missing('Deal', 'Deal_createdAt_idx',              '`createdAt`');
CALL add_index_if_missing('Deal', 'Deal_stage_createdAt_idx',        '`stage`, `createdAt`');
CALL add_index_if_missing('Deal', 'Deal_leadId_isActive_idx',        '`leadId`, `isActive`');

-- Cleanup
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Lead', 'Deal')
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
