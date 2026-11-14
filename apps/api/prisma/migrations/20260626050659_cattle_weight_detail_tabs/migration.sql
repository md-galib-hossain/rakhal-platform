-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightRecord_cattleId_idx" ON "WeightRecord"("cattleId");

-- CreateIndex
CREATE INDEX "WeightRecord_cattleId_recordedDate_idx" ON "WeightRecord"("cattleId", "recordedDate");

-- AddForeignKey
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
