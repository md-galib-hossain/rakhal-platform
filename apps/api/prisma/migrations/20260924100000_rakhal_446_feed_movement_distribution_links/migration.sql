-- RAKHAL-446 (MILESTONE 26): a feeding draws feed lots FIFO; each per-lot movement records which
-- distribution / cow-line caused it so a void credits back exactly those lots. Additive, nullable.
ALTER TABLE "FeedItemStockMovement" ADD COLUMN "feedDistributionId" TEXT;
ALTER TABLE "FeedItemStockMovement" ADD COLUMN "feedDistributionCattleItemId" TEXT;

CREATE INDEX "FeedItemStockMovement_feedDistributionId_idx" ON "FeedItemStockMovement"("feedDistributionId");
CREATE INDEX "FeedItemStockMovement_feedDistributionCattleItemId_idx" ON "FeedItemStockMovement"("feedDistributionCattleItemId");
