-- Feeding sessions removed (one confirm per cow per day): drop the per-row session tag.
ALTER TABLE "FeedDistributionCattleItem" DROP COLUMN "session";
