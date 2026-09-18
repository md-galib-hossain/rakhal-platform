-- RAKHAL-434 (Medicine Batch Model, docs/EPIC_MEDICINE_BATCH_MODEL.md) — additive only,
-- hand-authored per this repo's established shared-dev-DB pattern (`migrate dev` refuses
-- non-interactive). Schema-only step: no service reads/writes MedicineBatch yet (RAKHAL-435).
-- Medicine.currentStock/costPerUnit/purchaseDate/expiryDate/batchId stay authoritative and
-- are NOT dropped here.

-- CreateTable
CREATE TABLE "MedicineBatch" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "batchCode" TEXT,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable: repoint stock movements onto their originating batch (nullable until
-- RAKHAL-435 repoints MedicineService; the backfill script below sets it on existing rows).
ALTER TABLE "MedicineStockMovement" ADD COLUMN "medicineBatchId" TEXT;

-- CreateIndex
CREATE INDEX "MedicineBatch_medicineId_idx" ON "MedicineBatch"("medicineId");

-- CreateIndex
CREATE INDEX "MedicineBatch_farmId_idx" ON "MedicineBatch"("farmId");

-- CreateIndex
CREATE INDEX "MedicineBatch_batchCode_idx" ON "MedicineBatch"("batchCode");

-- CreateIndex
CREATE INDEX "MedicineBatch_expiryDate_idx" ON "MedicineBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "MedicineStockMovement_medicineBatchId_idx" ON "MedicineStockMovement"("medicineBatchId");

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineBatch" ADD CONSTRAINT "MedicineBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineStockMovement" ADD CONSTRAINT "MedicineStockMovement_medicineBatchId_fkey" FOREIGN KEY ("medicineBatchId") REFERENCES "MedicineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
