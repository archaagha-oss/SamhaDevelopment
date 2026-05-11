-- Escrow transaction ledger — per-deal credits / debits / reconciliation
-- against the project's escrow account (ProjectBankAccount with purpose=ESCROW).
--
-- The bank-account row already exists; this migration adds only the
-- transaction-level table. Idempotent: re-running is a no-op.
-- Pattern matches 2026-05-10_handover_checklist.sql.

CREATE TABLE IF NOT EXISTS `EscrowTransaction` (
  `id`              VARCHAR(191)  NOT NULL,
  `dealId`          VARCHAR(191)  NOT NULL,
  `projectId`       VARCHAR(191)  NOT NULL,
  `bankAccountId`   VARCHAR(191)  NULL,
  `type`            VARCHAR(191)  NOT NULL,
  `amount`          DOUBLE        NOT NULL,
  `transactionDate` DATETIME(3)   NOT NULL,
  `reference`       VARCHAR(191)  NULL,
  `paymentId`       VARCHAR(191)  NULL,
  `notes`           TEXT          NULL,
  `createdBy`       VARCHAR(191)  NOT NULL,
  `createdAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `EscrowTransaction_dealId_fkey`
    FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `EscrowTransaction_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
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

CALL add_index_if_missing('EscrowTransaction', 'EscrowTransaction_dealId_idx',          '`dealId`');
CALL add_index_if_missing('EscrowTransaction', 'EscrowTransaction_projectId_idx',       '`projectId`');
CALL add_index_if_missing('EscrowTransaction', 'EscrowTransaction_type_idx',            '`type`');
CALL add_index_if_missing('EscrowTransaction', 'EscrowTransaction_transactionDate_idx', '`transactionDate`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'EscrowTransaction'
-- ORDER BY INDEX_NAME, SEQ_IN_INDEX;
