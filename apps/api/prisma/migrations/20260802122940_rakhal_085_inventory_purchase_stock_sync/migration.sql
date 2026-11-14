-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('MEDICINE', 'FEED_ITEM', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "EquipmentStockMovementReason" AS ENUM ('PURCHASE', 'ADJUSTMENT', 'DISPOSED', 'CORRECTION');

-- CreateEnum
CREATE TYPE "FeedItemStockMovementReason" AS ENUM ('PURCHASE', 'DISTRIBUTION', 'ADJUSTMENT', 'CORRECTION');

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "inventoryItemId" TEXT,
ADD COLUMN     "inventoryItemType" "InventoryItemType";

-- CreateTable
CREATE TABLE "EquipmentStockMovement" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reason" "EquipmentStockMovementReason" NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItemStockMovement" (
    "id" TEXT NOT NULL,
    "feedItemId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reason" "FeedItemStockMovementReason" NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedItemStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentStockMovement_equipmentId_idx" ON "EquipmentStockMovement"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentStockMovement_farmId_idx" ON "EquipmentStockMovement"("farmId");

-- CreateIndex
CREATE INDEX "EquipmentStockMovement_createdAt_idx" ON "EquipmentStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "FeedItemStockMovement_feedItemId_idx" ON "FeedItemStockMovement"("feedItemId");

-- CreateIndex
CREATE INDEX "FeedItemStockMovement_farmId_idx" ON "FeedItemStockMovement"("farmId");

-- CreateIndex
CREATE INDEX "FeedItemStockMovement_createdAt_idx" ON "FeedItemStockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "EquipmentStockMovement" ADD CONSTRAINT "EquipmentStockMovement_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItemStockMovement" ADD CONSTRAINT "FeedItemStockMovement_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
