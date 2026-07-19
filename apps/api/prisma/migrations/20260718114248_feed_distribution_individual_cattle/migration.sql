-- AlterTable
ALTER TABLE "FeedDistribution" ADD COLUMN     "cattleId" TEXT;

-- CreateIndex
CREATE INDEX "FeedDistribution_farmId_cattleId_idx" ON "FeedDistribution"("farmId", "cattleId");
