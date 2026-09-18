-- RD-089 (docs/TECH_DEBT.md) — two concurrent saves for the same cow/date/source could both miss
-- the app-level `findFirst`-then-create check and duplicate a FeedFeedingDraft row. Postgres can't
-- express uniqueness across two mutually-exclusive nullable FK columns with a single constraint
-- (feedItemId/feedStockId — exactly one is set per row, matching sourceType), so this is two
-- PARTIAL unique indexes, one per branch, each scoped to only the rows where its own FK is set.
-- Prisma's schema DSL has no way to express a filtered/partial index, so this exists purely as a
-- hand-authored migration (additive only, per this repo's shared-dev-DB convention) with a doc
-- comment on the FeedFeedingDraft model pointing here — `prisma db pull`/`migrate diff` will show
-- schema drift for these two indexes specifically, expected and intentional.

CREATE UNIQUE INDEX "FeedFeedingDraft_farm_cattle_date_item_key"
  ON "FeedFeedingDraft" ("farmId", "cattleId", "logDate", "sourceType", "feedItemId")
  WHERE "feedItemId" IS NOT NULL;

CREATE UNIQUE INDEX "FeedFeedingDraft_farm_cattle_date_stock_key"
  ON "FeedFeedingDraft" ("farmId", "cattleId", "logDate", "sourceType", "feedStockId")
  WHERE "feedStockId" IS NOT NULL;
