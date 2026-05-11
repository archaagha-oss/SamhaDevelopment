-- Deal.stageEnteredAt — timestamp the deal entered its current stage.
--
-- Backs My Day's "deals stalled in stage" rollup so it doesn't have to use
-- Deal.updatedAt as a proxy (which moves on every field write — discount
-- edits, broker reassignments, etc.).
--
-- Backfill rule for existing rows: use the latest matching DealStageHistory
-- row's changedAt (transitions INTO the current stage), falling back to the
-- deal's createdAt when no history rows exist yet.
--
-- Idempotent: column add and backfill are both guarded.

-- ── 1. Add the column (guarded) ──────────────────────────────────────────

DROP PROCEDURE IF EXISTS add_stage_entered_at_column;
DELIMITER $$
CREATE PROCEDURE add_stage_entered_at_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'Deal'
      AND COLUMN_NAME  = 'stageEnteredAt'
  ) THEN
    ALTER TABLE `Deal`
      ADD COLUMN `stageEnteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
  END IF;
END$$
DELIMITER ;

CALL add_stage_entered_at_column();
DROP PROCEDURE add_stage_entered_at_column;

-- ── 2. Backfill from DealStageHistory ────────────────────────────────────
-- Pick the latest history row per deal whose `newStage` matches the deal's
-- current stage; fall back to `createdAt` for deals with no matching history.
-- Safe to re-run: only updates rows where the current value equals the
-- post-add default of CURRENT_TIMESTAMP — heuristic check that `stageEnteredAt`
-- still equals the row's `updatedAt` (i.e. nobody has touched it yet).

UPDATE `Deal` d
LEFT JOIN (
  SELECT h.dealId, MAX(h.changedAt) AS enteredAt
  FROM `DealStageHistory` h
  INNER JOIN `Deal` dd ON dd.id = h.dealId AND dd.stage = h.newStage
  GROUP BY h.dealId
) latest ON latest.dealId = d.id
SET d.`stageEnteredAt` = COALESCE(latest.enteredAt, d.`createdAt`)
WHERE d.`stageEnteredAt` >= d.`updatedAt` - INTERVAL 1 SECOND
  AND d.`stageEnteredAt` <= d.`updatedAt` + INTERVAL 1 SECOND;

-- Verification (optional):
-- SELECT id, stage, stageEnteredAt, updatedAt, createdAt FROM `Deal`
-- ORDER BY stageEnteredAt DESC LIMIT 20;
