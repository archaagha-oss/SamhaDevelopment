-- Snag list backend. Per-unit walk-through snag tracking with items + photos.
--
-- Idempotent: every CREATE/INDEX is guarded so re-running the file is a no-op.
-- Pattern matches 2026-05-10_handover_checklist.sql (stored-procedure check
-- for indexes) and 2026-05-10_perf_indexes.sql.

CREATE TABLE IF NOT EXISTS `SnagList` (
  `id`        VARCHAR(191) NOT NULL,
  `unitId`    VARCHAR(191) NOT NULL,
  `label`     VARCHAR(191) NOT NULL,
  `raisedBy`  VARCHAR(191) NOT NULL,
  `raisedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt`  DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `SnagList_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SnagItem` (
  `id`               VARCHAR(191) NOT NULL,
  `snagListId`       VARCHAR(191) NOT NULL,
  `room`             VARCHAR(191) NULL,
  `category`         VARCHAR(191) NULL,
  `description`      TEXT         NOT NULL,
  `severity`         VARCHAR(191) NOT NULL,
  `status`           VARCHAR(191) NOT NULL DEFAULT 'RAISED',
  `contractorName`   VARCHAR(191) NULL,
  `dueDate`          DATETIME(3)  NULL,
  `fixedDate`        DATETIME(3)  NULL,
  `closedDate`       DATETIME(3)  NULL,
  `rejectionReason`  TEXT         NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `SnagItem_snagListId_fkey`
    FOREIGN KEY (`snagListId`) REFERENCES `SnagList`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SnagPhoto` (
  `id`          VARCHAR(191) NOT NULL,
  `snagItemId`  VARCHAR(191) NOT NULL,
  `s3Key`       VARCHAR(191) NOT NULL,
  `caption`     VARCHAR(191) NULL,
  `kind`        VARCHAR(191) NOT NULL DEFAULT 'BEFORE',
  `uploadedBy`  VARCHAR(191) NOT NULL,
  `uploadedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `SnagPhoto_snagItemId_fkey`
    FOREIGN KEY (`snagItemId`) REFERENCES `SnagItem`(`id`)
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

CALL add_index_if_missing('SnagList',  'SnagList_unitId_idx',       '`unitId`');
CALL add_index_if_missing('SnagItem',  'SnagItem_snagListId_idx',   '`snagListId`');
CALL add_index_if_missing('SnagItem',  'SnagItem_status_idx',       '`status`');
CALL add_index_if_missing('SnagPhoto', 'SnagPhoto_snagItemId_idx',  '`snagItemId`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('SnagList', 'SnagItem', 'SnagPhoto')
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
