-- ============================================================
-- Settings audit log: per-section change tracking for AppSettings.
--
-- Every successful PATCH against /api/settings/* records a row here
-- with the fields that changed, the before/after values (with
-- secrets masked), the actor, the IP/UA, and an optional reason.
--
-- After running this, `prisma db push` should be a no-op.
-- ============================================================

-- Branding + new fields on AppSettings.
ALTER TABLE `AppSettings`
  ADD COLUMN IF NOT EXISTS `secondaryColor` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `theme`          VARCHAR(16)  NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS `featureFlags`   JSON         NULL;

-- Per-user notification overrides.
ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `notificationPrefs` JSON NULL;

-- API keys (service tokens for portal apps + integrations).
CREATE TABLE `ApiKey` (
  `id`             VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name`           VARCHAR(191) NOT NULL,
  `prefix`         VARCHAR(32)  NOT NULL,
  `hashedKey`      VARCHAR(128) NOT NULL,
  `scopes`         JSON         NOT NULL,
  `expiresAt`      DATETIME(3)  NULL,
  `lastUsedAt`     DATETIME(3)  NULL,
  `revokedAt`      DATETIME(3)  NULL,
  `createdById`    VARCHAR(191) NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ApiKey_prefix_key` (`prefix`),
  UNIQUE KEY `ApiKey_hashedKey_key` (`hashedKey`),
  KEY `ApiKey_org_revokedAt_idx` (`organizationId`, `revokedAt`),
  CONSTRAINT `ApiKey_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `SettingsAuditLog` (
  `id`             VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `section`        VARCHAR(64)  NOT NULL,
  `changedFields`  JSON         NOT NULL,
  `before`         JSON         NULL,
  `after`          JSON         NULL,
  `reason`         TEXT         NULL,
  `userId`         VARCHAR(191) NULL,
  `ip`             VARCHAR(64)  NULL,
  `userAgent`      TEXT         NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `SettingsAuditLog_org_createdAt_idx` (`organizationId`, `createdAt`),
  KEY `SettingsAuditLog_section_createdAt_idx` (`section`, `createdAt`),
  KEY `SettingsAuditLog_userId_idx` (`userId`),
  CONSTRAINT `SettingsAuditLog_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
