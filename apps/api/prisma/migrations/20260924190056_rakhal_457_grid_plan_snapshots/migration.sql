-- AlterTable
ALTER TABLE "FeedDistributionCattleItem" ADD COLUMN     "feedPlanId" TEXT,
ADD COLUMN     "feedPlanLineId" TEXT,
ADD COLUMN     "plannedKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FeedFeedingDraft" ADD COLUMN     "feedPlanLineId" TEXT;
