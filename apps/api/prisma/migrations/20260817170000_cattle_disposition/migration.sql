-- CreateEnum
CREATE TYPE "CattleDispositionType" AS ENUM ('SALE', 'DEATH', 'CULL', 'TRANSFER');

-- AlterTable
ALTER TABLE "Cattle" ADD COLUMN     "dispositionId" TEXT,
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CattleDisposition" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "type" "CattleDispositionType" NOT NULL,
    "saleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(18,2),
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CattleDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CattleDisposition_farmId_idx" ON "CattleDisposition"("farmId");

-- CreateIndex
CREATE INDEX "CattleDisposition_cattleId_idx" ON "CattleDisposition"("cattleId");

-- CreateIndex
CREATE INDEX "CattleDisposition_cattleId_type_idx" ON "CattleDisposition"("cattleId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Cattle_dispositionId_key" ON "Cattle"("dispositionId");

-- AddForeignKey
ALTER TABLE "CattleDisposition" ADD CONSTRAINT "CattleDisposition_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CattleDisposition" ADD CONSTRAINT "CattleDisposition_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "CattleDisposition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
