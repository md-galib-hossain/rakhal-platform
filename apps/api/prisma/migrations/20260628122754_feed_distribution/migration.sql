-- CreateTable
CREATE TABLE "FeedDistribution" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "concentrationId" TEXT NOT NULL,
    "feedGroupId" TEXT,
    "distributedAt" TIMESTAMP(3) NOT NULL,
    "totalPlannedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActualKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRefusalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPlannedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedDistributionItem" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "plannedKg" DOUBLE PRECISION NOT NULL,
    "actualKg" DOUBLE PRECISION NOT NULL,
    "refusalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "lineCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FeedDistributionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedDistribution_farmId_idx" ON "FeedDistribution"("farmId");

-- CreateIndex
CREATE INDEX "FeedDistribution_farmId_feedGroupId_idx" ON "FeedDistribution"("farmId", "feedGroupId");

-- CreateIndex
CREATE INDEX "FeedDistribution_farmId_distributedAt_idx" ON "FeedDistribution"("farmId", "distributedAt");

-- CreateIndex
CREATE INDEX "FeedDistributionItem_distributionId_idx" ON "FeedDistributionItem"("distributionId");

-- CreateIndex
CREATE INDEX "FeedDistributionItem_ingredientId_idx" ON "FeedDistributionItem"("ingredientId");

-- AddForeignKey
ALTER TABLE "FeedDistribution" ADD CONSTRAINT "FeedDistribution_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedDistributionItem" ADD CONSTRAINT "FeedDistributionItem_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "FeedDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
