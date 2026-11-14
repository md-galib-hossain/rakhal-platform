-- AlterTable
ALTER TABLE "FeedConcentration" ADD COLUMN     "versionNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FeedIngredient" ADD COLUMN     "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceConcentrationId" TEXT,
ADD COLUMN     "sourceConcentrationVersion" INTEGER;

-- CreateIndex
CREATE INDEX "FeedIngredient_sourceConcentrationId_idx" ON "FeedIngredient"("sourceConcentrationId");

-- AddForeignKey
ALTER TABLE "FeedIngredient" ADD CONSTRAINT "FeedIngredient_sourceConcentrationId_fkey" FOREIGN KEY ("sourceConcentrationId") REFERENCES "FeedConcentration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
