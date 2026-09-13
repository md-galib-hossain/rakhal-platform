-- RAKHAL-421/422 (docs/EPIC_PREPARED_FEED.md §4): unify prepared-feed lots onto one table.

-- RAKHAL-422: optional per-line batch link on a concentration recipe line — absent = virtual
-- catalogue line (unchanged behaviour), present = a real inventory batch to deduct on finalize.
ALTER TABLE "FeedConcentrationItem" ADD COLUMN "feedItemId" TEXT;
ALTER TABLE "FeedConcentrationItem" ADD COLUMN "feedStockId" TEXT;

-- RAKHAL-421: which finalize path produced this FeedStock lot. Every existing row is a TMR by
-- construction (a CONCENTRATE_TEMPLATE finalize never produced a FeedStock before this ticket —
-- see prisma/rakhal-421-migrate-concentrate-feeditems.ts for the RAKHAL-406-era FeedItem batches
-- being moved onto this table), so the default backfills every pre-existing row correctly.
ALTER TABLE "FeedStock" ADD COLUMN "kind" "FeedConcentrationKind" NOT NULL DEFAULT 'FEED_MIXTURE';
