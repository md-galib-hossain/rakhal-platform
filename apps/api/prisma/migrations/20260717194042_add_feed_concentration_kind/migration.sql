-- CreateEnum
CREATE TYPE "FeedConcentrationKind" AS ENUM ('CONCENTRATE_TEMPLATE', 'FEED_MIXTURE');

-- AlterTable: add nullable first, backfill existing rows, then enforce NOT NULL.
-- Backfill rule mirrors the pre-existing client-side split this replaces (feed-view.tsx's
-- balance_score != null heuristic): a row with both target fields set was being treated as a
-- Feed Mixture, everything else as a template.
ALTER TABLE "FeedConcentration" ADD COLUMN "kind" "FeedConcentrationKind";

UPDATE "FeedConcentration"
SET "kind" = CASE
  WHEN "targetWeightKg" IS NOT NULL AND "targetMilkL" IS NOT NULL THEN 'FEED_MIXTURE'::"FeedConcentrationKind"
  ELSE 'CONCENTRATE_TEMPLATE'::"FeedConcentrationKind"
END;

ALTER TABLE "FeedConcentration" ALTER COLUMN "kind" SET NOT NULL;
