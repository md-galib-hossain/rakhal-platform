-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('MILKING', 'DRY', 'FRESH', 'GROWING', 'SOLD', 'DECEASED');

-- AlterTable
ALTER TABLE "Cattle" ADD COLUMN     "feedGroupId" TEXT,
ADD COLUMN     "lastBcs" DOUBLE PRECISION,
ADD COLUMN     "lastWeightKg" DOUBLE PRECISION,
ADD COLUMN     "productionStatus" "ProductionStatus" NOT NULL DEFAULT 'GROWING';

-- CreateTable
CREATE TABLE "BodyConditionScore" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyConditionScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyConditionScore_cattleId_idx" ON "BodyConditionScore"("cattleId");

-- CreateIndex
CREATE INDEX "BodyConditionScore_cattleId_recordedDate_idx" ON "BodyConditionScore"("cattleId", "recordedDate");

-- CreateIndex
CREATE INDEX "Cattle_farmId_productionStatus_idx" ON "Cattle"("farmId", "productionStatus");

-- AddForeignKey
ALTER TABLE "BodyConditionScore" ADD CONSTRAINT "BodyConditionScore_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
