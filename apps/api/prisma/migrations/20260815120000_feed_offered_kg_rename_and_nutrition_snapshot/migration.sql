-- Hand-authored (2026-08-15): a plain `prisma migrate dev` diff would DROP+ADD the two renamed
-- columns (Prisma can't infer a rename from schema diffing alone) and refuses non-interactively
-- because `FeedDistributionCattleItem` already has 28 non-null rows from the just-shipped Feeding
-- Grid e2e suite. RENAME COLUMN preserves that data losslessly instead.

-- Phase 0: `quantityKg` -> `offeredKg` (real farms can only report what was offered, not what a
-- cow actually consumed; the field/API/UI must never imply "consumed").
ALTER TABLE "FeedFeedingDraft" RENAME COLUMN "quantityKg" TO "offeredKg";
ALTER TABLE "FeedDistributionCattleItem" RENAME COLUMN "quantityKg" TO "offeredKg";

-- Phase 1: frozen nutrient snapshot on FeedDistributionItem, same field set/names as FeedStock's
-- own snapshot. Nullable, no backfill — null means "not available for this historical entry".
ALTER TABLE "FeedDistributionItem"
  ADD COLUMN "dmPct" DOUBLE PRECISION,
  ADD COLUMN "cpPct" DOUBLE PRECISION,
  ADD COLUMN "meMjPerKgDm" DOUBLE PRECISION,
  ADD COLUMN "fatPct" DOUBLE PRECISION,
  ADD COLUMN "ndfPct" DOUBLE PRECISION,
  ADD COLUMN "rdpPct" DOUBLE PRECISION,
  ADD COLUMN "rupPct" DOUBLE PRECISION,
  ADD COLUMN "starchPct" DOUBLE PRECISION,
  ADD COLUMN "adfPct" DOUBLE PRECISION,
  ADD COLUMN "calciumPct" DOUBLE PRECISION,
  ADD COLUMN "phosphorusPct" DOUBLE PRECISION,
  ADD COLUMN "tdnPct" DOUBLE PRECISION;
