-- Construction milestone tracker — N rows per project.
--
-- Distinct from Project.completionStatus (high-level enum), Project.handoverDate
-- (single date), and ProjectUpdate (media-attached news items). Each milestone
-- has a target date, optional completion date, and a 0-100 progress percentage.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + the existing add_index_if_missing
-- stored-procedure pattern (matches 2026-05-10_handover_checklist.sql).

CREATE TABLE IF NOT EXISTS `ConstructionMilestone` (
  `id`              VARCHAR(191) NOT NULL,
  `projectId`       VARCHAR(191) NOT NULL,
  `label`           VARCHAR(191) NOT NULL,
  `description`     TEXT         NULL,
  `targetDate`      DATETIME(3)  NOT NULL,
  `completedDate`   DATETIME(3)  NULL,
  `progressPercent` INT          NOT NULL DEFAULT 0,
  `sortOrder`       INT          NOT NULL DEFAULT 0,
  `notes`           TEXT         NULL,
  `lastUpdatedBy`   VARCHAR(191) NULL,
  `createdAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ConstructionMilestone_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
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

CALL add_index_if_missing('ConstructionMilestone', 'ConstructionMilestone_projectId_idx',  '`projectId`');
CALL add_index_if_missing('ConstructionMilestone', 'ConstructionMilestone_targetDate_idx', '`targetDate`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'ConstructionMilestone'
-- ORDER BY INDEX_NAME, SEQ_IN_INDEX;
