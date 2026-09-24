-- RAKHAL-450 (MILESTONE 26, step b of the two-step rollout): drop the legacy per-product stock/cost/date/
-- moisture columns. Since RAKHAL-442 every product owns real lots (FeedItemBatch) that carry stock, cost and
-- purchase date, and moisture is derived from dry matter. Refuses to run if any product still has no lot,
-- so no stock can be lost — run prisma/rakhal-442-migrate-feeditem-batches.ts first.
DO $$
DECLARE orphans integer;
BEGIN
  SELECT count(*) INTO orphans
  FROM "Forage" f
  WHERE NOT EXISTS (SELECT 1 FROM "FeedItemBatch" b WHERE b."feedItemId" = f.id);
  IF orphans > 0 THEN
    RAISE EXCEPTION 'RAKHAL-450: % feed item(s) have no batch — run the RAKHAL-442 backfill before dropping the legacy columns', orphans;
  END IF;
END $$;

ALTER TABLE "Forage" DROP COLUMN "currentStock";
ALTER TABLE "Forage" DROP COLUMN "costPerUnit";
ALTER TABLE "Forage" DROP COLUMN "purchaseDate";
ALTER TABLE "Forage" DROP COLUMN "moisturePct";
