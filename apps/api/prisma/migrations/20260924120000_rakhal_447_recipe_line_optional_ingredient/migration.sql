-- RAKHAL-447 (MILESTONE 26): a recipe line linked to an inventory product takes its nutrition from the
-- lot's NutritionProfile, so its catalogue ingredient becomes optional; the line may pin one lot.
-- Additive: relaxes NOT NULL and adds a nullable column — existing rows are unchanged.
ALTER TABLE "FeedConcentrationItem" ALTER COLUMN "ingredientId" DROP NOT NULL;
ALTER TABLE "FeedConcentrationItem" ADD COLUMN "feedItemBatchId" TEXT;
