-- RAKHAL-282: MilkQualityTest model (lab/device fat/protein/lactose/SCC/MUN
-- readings). Purely additive — new enum + new table + one FK to Cattle, no
-- existing columns/tables touched, no data migration needed. `farmId` and
-- `lactationId` are plain scalar columns with no FK constraint (deliberate —
-- see the model's doc comment in prisma/schemas/milk/milk.prisma: avoids
-- touching the hot farm.prisma and the concurrently-edited reproduction.prisma).

-- CreateEnum
CREATE TYPE "MilkQualityTestSource" AS ENUM ('LAB', 'DEVICE', 'MANUAL');

-- CreateTable
CREATE TABLE "MilkQualityTest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "lactationId" TEXT NOT NULL,
    "sampleDate" TIMESTAMP(3) NOT NULL,
    "fatPct" DOUBLE PRECISION NOT NULL,
    "proteinPct" DOUBLE PRECISION NOT NULL,
    "lactosePct" DOUBLE PRECISION,
    "somaticCellCount" DOUBLE PRECISION,
    "milkUreaNitrogen" DOUBLE PRECISION,
    "source" "MilkQualityTestSource" NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkQualityTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilkQualityTest_farmId_idx" ON "MilkQualityTest"("farmId");

-- CreateIndex
CREATE INDEX "MilkQualityTest_farmId_sampleDate_idx" ON "MilkQualityTest"("farmId", "sampleDate");

-- CreateIndex
CREATE INDEX "MilkQualityTest_cattleId_idx" ON "MilkQualityTest"("cattleId");

-- CreateIndex
CREATE INDEX "MilkQualityTest_cattleId_sampleDate_idx" ON "MilkQualityTest"("cattleId", "sampleDate");

-- CreateIndex
CREATE INDEX "MilkQualityTest_lactationId_idx" ON "MilkQualityTest"("lactationId");

-- AddForeignKey
ALTER TABLE "MilkQualityTest" ADD CONSTRAINT "MilkQualityTest_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
