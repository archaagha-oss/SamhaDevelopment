-- ============================================================
-- Optimistic locking for Deal / Lead / Unit.
--
-- Adds a `version` integer column (default 0) to each of the three
-- entities that frontend forms commonly edit concurrently. The API
-- bumps `version` on every successful update via WHERE version = N
-- so that two agents editing the same row never silently overwrite
-- each other — the loser gets HTTP 409 + the current row instead.
--
-- See apps/api/src/lib/optimisticLock.ts and the matching frontend
-- handler in apps/web/src/hooks/useOptimisticConflict.ts.
--
-- After running this, `prisma db push` against the matching schema.prisma
-- changes should be a no-op.
-- ============================================================

ALTER TABLE `Deal`
  ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0;

ALTER TABLE `Lead`
  ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0;

ALTER TABLE `Unit`
  ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0;
