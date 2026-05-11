-- Commission Tiers — configuration for how new Commission rows are computed.
--
-- Three tables:
--   CommissionTierRule  : a named bracket-set (project-scoped or global)
--   CommissionTier      : individual sale-price brackets under a rule
--   CommissionSplit     : per-agent split for a deal (with denormalised ruleId
--                         snapshot for audit)
--
-- Idempotent: every CREATE/INDEX is guarded so re-running the file is a no-op.
-- Pattern matches 2026-05-10_handover_checklist.sql (CREATE TABLE IF NOT
-- EXISTS for tables; stored-procedure check for indexes).

CREATE TABLE IF NOT EXISTS `CommissionTierRule` (
  `id`          VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `description` TEXT         NULL,
  `isActive`    TINYINT(1)   NOT NULL DEFAULT 1,
  `priority`    INT          NOT NULL DEFAULT 0,
  `projectId`   VARCHAR(191) NULL,
  `validFrom`   DATETIME(3)  NULL,
  `validUntil`  DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `CommissionTierRule_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommissionTier` (
  `id`           VARCHAR(191) NOT NULL,
  `ruleId`       VARCHAR(191) NOT NULL,
  `minSalePrice` DOUBLE       NULL,
  `maxSalePrice` DOUBLE       NULL,
  `ratePercent`  DOUBLE       NOT NULL,
  `flatBonus`    DOUBLE       NOT NULL DEFAULT 0,
  `sortOrder`    INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `CommissionTier_ruleId_fkey`
    FOREIGN KEY (`ruleId`) REFERENCES `CommissionTierRule`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommissionSplit` (
  `id`        VARCHAR(191) NOT NULL,
  `dealId`    VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `ruleId`    VARCHAR(191) NULL,
  `percent`   DOUBLE       NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CommissionSplit_dealId_userId_key` (`dealId`, `userId`),
  CONSTRAINT `CommissionSplit_dealId_fkey`
    FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommissionSplit_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CommissionSplit_ruleId_fkey`
    FOREIGN KEY (`ruleId`) REFERENCES `CommissionTierRule`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
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

CALL add_index_if_missing('CommissionTierRule', 'CommissionTierRule_projectId_idx',          '`projectId`');
CALL add_index_if_missing('CommissionTierRule', 'CommissionTierRule_isActive_priority_idx',  '`isActive`, `priority`');

CALL add_index_if_missing('CommissionTier',     'CommissionTier_ruleId_idx',                 '`ruleId`');
CALL add_index_if_missing('CommissionTier',     'CommissionTier_ruleId_sortOrder_idx',       '`ruleId`, `sortOrder`');

CALL add_index_if_missing('CommissionSplit',    'CommissionSplit_dealId_idx',                '`dealId`');
CALL add_index_if_missing('CommissionSplit',    'CommissionSplit_userId_idx',                '`userId`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('CommissionTierRule', 'CommissionTier', 'CommissionSplit')
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
