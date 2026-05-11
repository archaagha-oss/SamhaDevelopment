-- KYC Verification — one LeadKyc per lead + many KycDocuments per KYC.
--
-- Tracks four verification flags (Emirates ID, Passport, Address proof,
-- Source of funds), approval lifecycle (PENDING → IN_REVIEW → APPROVED |
-- REJECTED | EXPIRED), and S3-backed supporting documents. KYC docs expire
-- one year after approval; a scheduled job can flip stale records to EXPIRED.
--
-- Idempotent: every CREATE/INDEX is guarded so re-running the file is a no-op.
-- Pattern matches 2026-05-10_handover_checklist.sql.

CREATE TABLE IF NOT EXISTS `LeadKyc` (
  `id`                     VARCHAR(191)  NOT NULL,
  `leadId`                 VARCHAR(191)  NOT NULL,
  `status`                 VARCHAR(191)  NOT NULL DEFAULT 'PENDING',
  `emiratesIdVerified`     TINYINT(1)    NOT NULL DEFAULT 0,
  `passportVerified`       TINYINT(1)    NOT NULL DEFAULT 0,
  `addressProofVerified`   TINYINT(1)    NOT NULL DEFAULT 0,
  `sourceOfFundsVerified`  TINYINT(1)    NOT NULL DEFAULT 0,
  `reviewedBy`             VARCHAR(191)  NULL,
  `reviewedAt`             DATETIME(3)   NULL,
  `notes`                  TEXT          NULL,
  `expiresAt`              DATETIME(3)   NULL,
  `createdAt`              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`              DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `LeadKyc_leadId_key` (`leadId`),
  CONSTRAINT `LeadKyc_leadId_fkey`
    FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `KycDocument` (
  `id`               VARCHAR(191)  NOT NULL,
  `kycId`            VARCHAR(191)  NOT NULL,
  `type`             VARCHAR(191)  NOT NULL,
  `s3Key`            VARCHAR(191)  NOT NULL,
  `originalFilename` VARCHAR(191)  NULL,
  `uploadedBy`       VARCHAR(191)  NOT NULL,
  `uploadedAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `verifiedAt`       DATETIME(3)   NULL,
  `verifiedBy`       VARCHAR(191)  NULL,
  `expiryDate`       DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `KycDocument_kycId_fkey`
    FOREIGN KEY (`kycId`) REFERENCES `LeadKyc`(`id`)
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

CALL add_index_if_missing('LeadKyc',     'LeadKyc_leadId_idx',    '`leadId`');
CALL add_index_if_missing('LeadKyc',     'LeadKyc_status_idx',    '`status`');
CALL add_index_if_missing('LeadKyc',     'LeadKyc_expiresAt_idx', '`expiresAt`');
CALL add_index_if_missing('KycDocument', 'KycDocument_kycId_idx', '`kycId`');
CALL add_index_if_missing('KycDocument', 'KycDocument_type_idx',  '`type`');

DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verification (optional — run manually):
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.statistics
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME IN ('LeadKyc', 'KycDocument')
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
