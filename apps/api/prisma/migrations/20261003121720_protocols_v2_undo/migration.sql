-- AlterTable
ALTER TABLE "MedicineStockMovement" ADD COLUMN     "treatmentLogId" TEXT;

-- AlterTable
ALTER TABLE "PlanEnrollment" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TreatmentLog" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedBy" TEXT;

-- CreateIndex
CREATE INDEX "MedicineStockMovement_treatmentLogId_idx" ON "MedicineStockMovement"("treatmentLogId");
