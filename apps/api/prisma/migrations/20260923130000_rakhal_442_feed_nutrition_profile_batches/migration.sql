-- RAKHAL-442 (MILESTONE 26, docs/EPIC_FEED_NUTRITION_PROFILE.md, ADR-026) — step (a), purely additive.
-- Adds the immutable NutritionProfile + FeedItemBatch lot model and the nullable columns that point at
-- them. Nothing is dropped or made required here: the old Forage (FeedItem) stock/cost/purchase columns
-- stay until RAKHAL-450. Run prisma/rakhal-442-migrate-feeditem-batches.ts afterwards to give every
-- existing feed item its first batch + nutrition profile.

-- CreateTable
CREATE TABLE "NutritionProfile" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "dmPct" DOUBLE PRECISION NOT NULL,
    "cpPct" DOUBLE PRECISION NOT NULL,
    "meMjPerKgDm" DOUBLE PRECISION NOT NULL,
    "fatPct" DOUBLE PRECISION,
    "ndfPct" DOUBLE PRECISION,
    "adfPct" DOUBLE PRECISION,
    "rdpPct" DOUBLE PRECISION,
    "rupPct" DOUBLE PRECISION,
    "starchPct" DOUBLE PRECISION,
    "sugarsPct" DOUBLE PRECISION,
    "calciumPct" DOUBLE PRECISION,
    "phosphorusPct" DOUBLE PRECISION,
    "tdnPct" DOUBLE PRECISION,
    "nutritionSource" "NutritionSource" NOT NULL DEFAULT 'FARM_ESTIMATE',
    "sourceRef" TEXT,
    "note" TEXT,
    "supersedesId" TEXT,
    "copiedFromIngredientId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItemBatch" (
    "id" TEXT NOT NULL,
    "feedItemId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "batchCode" TEXT,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "nutritionProfileId" TEXT NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedItemBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Forage" ADD COLUMN "defaultNutritionProfileId" TEXT;

-- AlterTable
ALTER TABLE "FeedItemStockMovement" ADD COLUMN "feedItemBatchId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN "feedItemBatchId" TEXT;

-- AlterTable
ALTER TABLE "FeedDistributionItem" ADD COLUMN "nutritionProfileId" TEXT,
ADD COLUMN "feedItemBatchId" TEXT;

-- AlterTable
ALTER TABLE "FeedDistributionCattleItem" ADD COLUMN "feedItemBatchId" TEXT,
ADD COLUMN "nutritionProfileId" TEXT;

-- CreateIndex
CREATE INDEX "NutritionProfile_farmId_idx" ON "NutritionProfile"("farmId");

-- CreateIndex
CREATE INDEX "NutritionProfile_supersedesId_idx" ON "NutritionProfile"("supersedesId");

-- CreateIndex
CREATE INDEX "FeedItemBatch_feedItemId_purchaseDate_idx" ON "FeedItemBatch"("feedItemId", "purchaseDate");

-- CreateIndex
CREATE INDEX "FeedItemBatch_farmId_idx" ON "FeedItemBatch"("farmId");

-- CreateIndex
CREATE INDEX "FeedItemBatch_batchCode_idx" ON "FeedItemBatch"("batchCode");

-- CreateIndex
CREATE INDEX "FeedItemBatch_nutritionProfileId_idx" ON "FeedItemBatch"("nutritionProfileId");

-- CreateIndex
CREATE INDEX "Forage_defaultNutritionProfileId_idx" ON "Forage"("defaultNutritionProfileId");

-- CreateIndex
CREATE INDEX "FeedItemStockMovement_feedItemBatchId_idx" ON "FeedItemStockMovement"("feedItemBatchId");

-- CreateIndex
CREATE INDEX "PurchaseLine_feedItemBatchId_idx" ON "PurchaseLine"("feedItemBatchId");

-- AddForeignKey
ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "NutritionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItemBatch" ADD CONSTRAINT "FeedItemBatch_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItemBatch" ADD CONSTRAINT "FeedItemBatch_nutritionProfileId_fkey" FOREIGN KEY ("nutritionProfileId") REFERENCES "NutritionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forage" ADD CONSTRAINT "Forage_defaultNutritionProfileId_fkey" FOREIGN KEY ("defaultNutritionProfileId") REFERENCES "NutritionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItemStockMovement" ADD CONSTRAINT "FeedItemStockMovement_feedItemBatchId_fkey" FOREIGN KEY ("feedItemBatchId") REFERENCES "FeedItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_feedItemBatchId_fkey" FOREIGN KEY ("feedItemBatchId") REFERENCES "FeedItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
