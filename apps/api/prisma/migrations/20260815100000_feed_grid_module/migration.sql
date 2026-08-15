-- Feeding Grid (2026-08-15) — replaces Quick Feed with a per-cow feed-session grid.
-- Hand-authored (prisma migrate dev refuses non-interactively in this environment,
-- same precedent as every other migration on docs/IN_FLIGHT.md): `prisma migrate diff`
-- output included an unrelated pre-existing SafetyWithdrawalStatus enum-drop (RD-054)
-- noise block, excluded here — same as every other hand-authored migration in this repo.

-- CreateEnum
CREATE TYPE "FeedGridSourceType" AS ENUM ('FEED_ITEM', 'FEED_STOCK');

-- AlterEnum
ALTER TYPE "FeedDistributionSourceType" ADD VALUE 'FEEDING_GRID';

-- CreateTable
CREATE TABLE "FeedDistributionCattleItem" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FeedDistributionCattleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedFeedingDraft" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "feedGroupId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "sourceType" "FeedGridSourceType" NOT NULL,
    "feedItemId" TEXT,
    "feedStockId" TEXT,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedFeedingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedDistributionCattleItem_distributionId_idx" ON "FeedDistributionCattleItem"("distributionId");

-- CreateIndex
CREATE INDEX "FeedDistributionCattleItem_cattleId_idx" ON "FeedDistributionCattleItem"("cattleId");

-- CreateIndex
CREATE INDEX "FeedFeedingDraft_farmId_idx" ON "FeedFeedingDraft"("farmId");

-- CreateIndex
CREATE INDEX "FeedFeedingDraft_farmId_cattleId_logDate_idx" ON "FeedFeedingDraft"("farmId", "cattleId", "logDate");

-- CreateIndex
CREATE INDEX "FeedFeedingDraft_farmId_logDate_idx" ON "FeedFeedingDraft"("farmId", "logDate");

-- AddForeignKey
ALTER TABLE "FeedDistributionCattleItem" ADD CONSTRAINT "FeedDistributionCattleItem_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "FeedDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedFeedingDraft" ADD CONSTRAINT "FeedFeedingDraft_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
