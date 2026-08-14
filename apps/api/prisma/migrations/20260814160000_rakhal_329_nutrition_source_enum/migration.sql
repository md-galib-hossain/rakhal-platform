-- RAKHAL-329: structured nutrition provenance.
-- Hand-authored (not `prisma migrate dev` output) to avoid the naive diff's DROP+ADD on
-- `FeedIngredient.nutritionSource`, which would discard existing free-text citations
-- (e.g. "INRA 2018/NRC 2001/BAU") — renamed to `nutritionSourceNote` instead, data preserved.
-- Excludes the unrelated pre-existing `SafetyWithdrawalStatus` enum-drop noise (RD-054,
-- out of this ticket's lane) that `prisma migrate diff` also reports.

-- CreateEnum
CREATE TYPE "NutritionSource" AS ENUM ('REFERENCE', 'MANUFACTURER', 'LAB', 'FARM_ESTIMATE');

-- Preserve existing free-text values under the renamed column
ALTER TABLE "FeedIngredient" RENAME COLUMN "nutritionSource" TO "nutritionSourceNote";

-- AlterTable: FeedIngredient gains the structured enum (backfilled REFERENCE) + sourceRef
ALTER TABLE "FeedIngredient"
  ADD COLUMN "nutritionSource" "NutritionSource" NOT NULL DEFAULT 'REFERENCE',
  ADD COLUMN "sourceRef" TEXT;

-- AlterTable: FeedIngredientOverride gains an optional provenance override
ALTER TABLE "FeedIngredientOverride"
  ADD COLUMN "nutritionSource" "NutritionSource",
  ADD COLUMN "sourceRef" TEXT;
