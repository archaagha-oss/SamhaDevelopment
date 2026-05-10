-- Closes audit gap #9. Handover checklist + items, one checklist per deal.
--
-- Idempotent: every CREATE/INDEX is guarded so re-running the file is a no-op.
-- Pattern matches 2026-05-10_perf_indexes.sql (stored-procedure check) for the
-- index step, and uses CREATE TABLE IF NOT EXISTS for the table step.

CREATE TABLE IF NOT EXISTS `HandoverChecklist` (
  `id`           VARCHAR(191)  NOT NULL,
  `dealId`       VARCHAR(191)  NOT NULL,
  `status`       VARCHAR(191)  NOT NULL DEFAULT 'IN_PROGRESS',
  `completedAt`  DATETIME(3)   NULL,
  `completedBy`  VARCHAR(191)  NULL,
  `notes`        TEXT          NULL,
  `createdAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `HandoverChecklist_dealId_key` (`dealId`),
  CONSTRAINT `HandoverChecklist_dealId_fkey`
    FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HandoverChecklistItem` (
  `id`           VARCHAR(191)  NOT NULL,
  `checklistId`  VARCHAR(191)  NOT NULL,
  `category`     VARCHAR(191)  NOT NULL,
  `label`        VARCHAR(191)  NOT NULL,
  `required`     TINYINT(1)    NOT NULL DEFAULT 1,
  `completed`    TINYINT(1)    NOT NULL DEFAULT 0,
  `completedAt`  DATETIME(3)   NULL,
  `completedBy`  VARCHAR(191)  NULL,
  `notes`        TEXT          NULL,
  `sortOrder`    INT           NOT NULL DEFAULT 0,
  `createdAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `HandoverChecklistItem_checklistId_fkey`
    FOREIGN KEY (`checklistId`) REFERENCES `HandoverChecklist`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes — wrapped in stored-procedure check so re-running is a no-op
-- (MySQL/MariaDB lacks CREATE INDEX IF NOT EXISTS on older versions).

DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_missing$$
CREATE PROCEDURE add_index_if_missing(
  IN tbl  VARCHAR(64),
  IN idx  VARCHAR(128),
  IN cols TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = tbl
      AND index_name   = idx
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` (', cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL add_index_if_missing('HandoverChecklist',     'HandoverChecklist_dealId_idx',          '`dealId`');
CALL add_index_if_missing('HandoverChecklistItem', 'HandoverChecklistItem_checklistId_idx', '`checklistId`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('HandoverChecklist', 'HandoverChecklistItem')
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
