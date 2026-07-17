-- CreateEnum
CREATE TYPE "FeedStockMovementReason" AS ENUM ('PRODUCED', 'FED', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "FeedStock" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sourceConcentrationId" TEXT NOT NULL,
    "sourceConcentrationVersion" INTEGER NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL,
    "producedQtyKg" DOUBLE PRECISION NOT NULL,
    "currentStockKg" DOUBLE PRECISION NOT NULL,
    "producedCostTk" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedStockMovement" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "changeKg" DOUBLE PRECISION NOT NULL,
    "reason" "FeedStockMovementReason" NOT NULL,
    "distributionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedStock_farmId_idx" ON "FeedStock"("farmId");

-- CreateIndex
CREATE INDEX "FeedStock_sourceConcentrationId_idx" ON "FeedStock"("sourceConcentrationId");

-- CreateIndex
CREATE INDEX "FeedStockMovement_stockId_idx" ON "FeedStockMovement"("stockId");

-- AddForeignKey
ALTER TABLE "FeedStock" ADD CONSTRAINT "FeedStock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedStock" ADD CONSTRAINT "FeedStock_sourceConcentrationId_fkey" FOREIGN KEY ("sourceConcentrationId") REFERENCES "FeedConcentration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedStockMovement" ADD CONSTRAINT "FeedStockMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "FeedStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
