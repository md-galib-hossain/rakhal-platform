-- RAKHAL-327: batch nutrition snapshot on FeedStock, step 1/2 (additive).
-- Hand-authored (not `prisma migrate dev` output, which refuses non-interactively here, same
-- precedent as the RAKHAL-326/RAKHAL-329 migrations). 38 existing `FeedStock` rows predate this
-- feature, so the 12 nutrient columns land nullable here and get backfilled by
-- `prisma/backfill-feedstock-nutrition.ts` before the finalize migration flips them to NOT NULL.
-- Excludes the unrelated pre-existing `SafetyWithdrawalStatus` enum-drop noise (RD-054, out of
-- this ticket's lane) that `prisma migrate diff` also reports.

ALTER TABLE "FeedStock"
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
  ADD COLUMN "tdnPct" DOUBLE PRECISION,
  ADD COLUMN "nutritionSource" "NutritionSource" NOT NULL DEFAULT 'REFERENCE',
  ADD COLUMN "sourceRef" TEXT;
