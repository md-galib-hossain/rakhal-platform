-- DropForeignKey
ALTER TABLE "FeedConcentrationItem" DROP CONSTRAINT "FeedConcentrationItem_ingredientId_fkey";

-- AlterTable
ALTER TABLE "FeedFeedingDraft" ADD COLUMN     "refusalKg" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "FeedConcentrationItem" ADD CONSTRAINT "FeedConcentrationItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "FeedIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
