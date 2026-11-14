-- CreateEnum
CREATE TYPE "FeedNutrientGroup" AS ENUM ('PROTEIN', 'ENERGY', 'FIBER');

-- AlterTable
ALTER TABLE "FeedIngredient" ADD COLUMN     "farmId" TEXT,
ADD COLUMN     "nutrientGroup" "FeedNutrientGroup";

-- CreateIndex
CREATE INDEX "FeedIngredient_farmId_idx" ON "FeedIngredient"("farmId");

-- AddForeignKey
ALTER TABLE "FeedIngredient" ADD CONSTRAINT "FeedIngredient_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
