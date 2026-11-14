-- RAKHAL-327: batch nutrition snapshot on FeedStock, step 2/2 (finalize).
-- Run only after `prisma/backfill-feedstock-nutrition.ts` has filled every existing row's
-- nutrient columns (verified zero NULLs remain before this ran, same two-step precedent as
-- RAKHAL-326's unit-catalog migration).

ALTER TABLE "FeedStock"
  ALTER COLUMN "dmPct" SET NOT NULL,
  ALTER COLUMN "cpPct" SET NOT NULL,
  ALTER COLUMN "meMjPerKgDm" SET NOT NULL,
  ALTER COLUMN "fatPct" SET NOT NULL,
  ALTER COLUMN "ndfPct" SET NOT NULL,
  ALTER COLUMN "rdpPct" SET NOT NULL,
  ALTER COLUMN "rupPct" SET NOT NULL,
  ALTER COLUMN "starchPct" SET NOT NULL,
  ALTER COLUMN "adfPct" SET NOT NULL,
  ALTER COLUMN "calciumPct" SET NOT NULL,
  ALTER COLUMN "phosphorusPct" SET NOT NULL,
  ALTER COLUMN "tdnPct" SET NOT NULL;
