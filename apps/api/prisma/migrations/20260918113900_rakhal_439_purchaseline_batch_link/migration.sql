-- RAKHAL-439 (Medicine Batch Model, docs/EPIC_MEDICINE_BATCH_MODEL.md) — additive only,
-- hand-authored per this repo's established shared-dev-DB pattern. Links a PurchaseLine to the
-- exact MedicineBatch its own createBatch() call created, so VoidDocumentUseCase can reverse the
-- specific lot a voided purchase created instead of a representative-batch guess. Nullable: a
-- pre-439 line has none; the void use case falls back to its old behavior for those.

-- AlterTable
ALTER TABLE "PurchaseLine" ADD COLUMN "medicineBatchId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseLine_medicineBatchId_idx" ON "PurchaseLine"("medicineBatchId");

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_medicineBatchId_fkey" FOREIGN KEY ("medicineBatchId") REFERENCES "MedicineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
