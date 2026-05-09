-- ============================================================
-- Team module: corporate redesign (no Department model).
--   * Adds employment metadata to User: jobTitle, manager, status,
--     employeeId, employmentType, joinedAt, lastLoginAt, lastSeenAt,
--     avatarUrl.
--   * Migrates UserRole enum: SALES_AGENT/OPERATIONS/FINANCE/DEVELOPER
--     collapse into MEMBER. ADMIN stays. Adds MANAGER and VIEWER.
--   * Drops legacy User.department text column.
--
-- MySQL strategy mirrors 2026-05-08_lead_stage_rename.sql:
--   widen ENUM, migrate rows, narrow ENUM.
-- After running this, `prisma db push` should be a no-op.
-- ============================================================

-- Step 1: Add new User columns.
ALTER TABLE `User`
  ADD COLUMN `jobTitle`       VARCHAR(255) NULL,
  ADD COLUMN `managerId`      VARCHAR(191) NULL,
  ADD COLUMN `status`         ENUM('ACTIVE','ON_LEAVE','SUSPENDED','DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `employeeId`     VARCHAR(64)  NULL,
  ADD COLUMN `employmentType` ENUM('FULL_TIME','PART_TIME','CONTRACT','INTERN') NULL,
  ADD COLUMN `joinedAt`       DATETIME(3)  NULL,
  ADD COLUMN `lastLoginAt`    DATETIME(3)  NULL,
  ADD COLUMN `lastSeenAt`     DATETIME(3)  NULL,
  ADD COLUMN `avatarUrl`      VARCHAR(500) NULL,
  ADD UNIQUE KEY `User_employeeId_key` (`employeeId`),
  ADD KEY `User_managerId_idx` (`managerId`),
  ADD KEY `User_status_idx`    (`status`);

-- Step 2: Backfill jobTitle from old role labels (preserves identity for
-- existing users so the team page doesn't go blank after migration).
UPDATE `User` SET `jobTitle` = 'Sales Agent'        WHERE `role` = 'SALES_AGENT' AND `jobTitle` IS NULL;
UPDATE `User` SET `jobTitle` = 'Operations Officer' WHERE `role` = 'OPERATIONS'  AND `jobTitle` IS NULL;
UPDATE `User` SET `jobTitle` = 'Finance Officer'    WHERE `role` = 'FINANCE'     AND `jobTitle` IS NULL;
UPDATE `User` SET `jobTitle` = 'Software Engineer'  WHERE `role` = 'DEVELOPER'   AND `jobTitle` IS NULL;
UPDATE `User` SET `jobTitle` = 'Administrator'      WHERE `role` = 'ADMIN'       AND `jobTitle` IS NULL;

-- Step 3: Widen UserRole enum to accept old + new values.
ALTER TABLE `User`
  MODIFY COLUMN `role` ENUM(
    'ADMIN','SALES_AGENT','OPERATIONS','FINANCE','DEVELOPER',
    'MANAGER','MEMBER','VIEWER'
  ) NOT NULL;

-- Step 4: Migrate role values. Legacy functional roles collapse into MEMBER.
-- ADMIN stays as ADMIN. New MANAGER / VIEWER assignments happen via UI.
UPDATE `User`
  SET `role` = 'MEMBER'
  WHERE `role` IN ('SALES_AGENT','OPERATIONS','FINANCE','DEVELOPER');

-- Step 5: Narrow UserRole enum to final values.
ALTER TABLE `User`
  MODIFY COLUMN `role` ENUM('ADMIN','MANAGER','MEMBER','VIEWER') NOT NULL;

-- Step 6: Drop the legacy free-text department column.
ALTER TABLE `User` DROP COLUMN `department`;

-- Step 7: Manager self-relation FK.
ALTER TABLE `User`
  ADD CONSTRAINT `User_managerId_fkey`
    FOREIGN KEY (`managerId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
