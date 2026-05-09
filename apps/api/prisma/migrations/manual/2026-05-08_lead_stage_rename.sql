-- Lead stage simplification: rename OFFER_SENT -> PROPOSAL, SITE_VISIT -> VIEWING.
-- MySQL strategy: widen ENUM to include both old + new values, UPDATE rows,
-- then `prisma db push` narrows the enum back to the 8 final values.

-- Step 1: widen Lead.stage to accept both old and new values.
ALTER TABLE `Lead`
  MODIFY COLUMN `stage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'OFFER_SENT','SITE_VISIT',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL DEFAULT 'NEW';

UPDATE `Lead` SET `stage` = 'PROPOSAL' WHERE `stage` = 'OFFER_SENT';
UPDATE `Lead` SET `stage` = 'VIEWING'  WHERE `stage` = 'SITE_VISIT';

-- Step 2: widen LeadStageHistory.oldStage / newStage and migrate rows.
ALTER TABLE `LeadStageHistory`
  MODIFY COLUMN `oldStage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'OFFER_SENT','SITE_VISIT',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL;

ALTER TABLE `LeadStageHistory`
  MODIFY COLUMN `newStage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'OFFER_SENT','SITE_VISIT',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL;

UPDATE `LeadStageHistory` SET `oldStage` = 'PROPOSAL' WHERE `oldStage` = 'OFFER_SENT';
UPDATE `LeadStageHistory` SET `oldStage` = 'VIEWING'  WHERE `oldStage` = 'SITE_VISIT';
UPDATE `LeadStageHistory` SET `newStage` = 'PROPOSAL' WHERE `newStage` = 'OFFER_SENT';
UPDATE `LeadStageHistory` SET `newStage` = 'VIEWING'  WHERE `newStage` = 'SITE_VISIT';

-- Step 3: narrow ENUMs back to the final 8 values.
ALTER TABLE `Lead`
  MODIFY COLUMN `stage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL DEFAULT 'NEW';

ALTER TABLE `LeadStageHistory`
  MODIFY COLUMN `oldStage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL;

ALTER TABLE `LeadStageHistory`
  MODIFY COLUMN `newStage` ENUM(
    'NEW','CONTACTED','QUALIFIED',
    'VIEWING','PROPOSAL',
    'NEGOTIATING','CLOSED_WON','CLOSED_LOST'
  ) NOT NULL;
