-- RAKHAL-429 (Feeding Favourites, docs/EPIC_FEEDING_FAVOURITES.md) — additive only, hand-authored
-- per this repo's established shared-dev-DB pattern (avoids `migrate dev`'s shadow-DB reset risk).

-- FeedDistributionCattleItem: this cow's own source for this confirm (nullable — old rows read
-- their source from the parent FeedDistribution instead), plus a feedGroupId snapshot for the
-- group-change guard (RAKHAL-431).
ALTER TABLE "FeedDistributionCattleItem"
  ADD COLUMN "sourceType" "FeedGridSourceType",
  ADD COLUMN "feedItemId" TEXT,
  ADD COLUMN "feedStockId" TEXT,
  ADD COLUMN "feedGroupId" TEXT;

-- FeedGroup: the group's own default feeding-grid source (separate from the TMR-only
-- defaultConcentrationId), the bottom rung of the resolution ladder.
ALTER TABLE "FeedGroup"
  ADD COLUMN "defaultFeedSourceType" "FeedGridSourceType",
  ADD COLUMN "defaultFeedItemId" TEXT,
  ADD COLUMN "defaultFeedStockId" TEXT;
