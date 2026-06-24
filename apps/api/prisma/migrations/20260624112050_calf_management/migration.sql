-- CreateEnum
CREATE TYPE "ColostrumQuality" AS ENUM ('EXCELLENT', 'GOOD', 'POOR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CalfMilkType" AS ENUM ('DAM_MILK', 'WHOLE_MILK', 'MILK_REPLACER');

-- CreateEnum
CREATE TYPE "CalfStarterEventType" AS ENUM ('FIRST_OFFERED', 'FIRST_INTAKE', 'DAILY_INTAKE');

-- CreateTable
CREATE TABLE "CalfColostrumRecord" (
    "id" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "feedNumber" INTEGER NOT NULL,
    "fedAt" TIMESTAMP(3) NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "quality" "ColostrumQuality" NOT NULL DEFAULT 'UNKNOWN',
    "fedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfColostrumRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalfMilkFeeding" (
    "id" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "morningMl" INTEGER NOT NULL DEFAULT 0,
    "eveningMl" INTEGER NOT NULL DEFAULT 0,
    "type" "CalfMilkType" NOT NULL DEFAULT 'WHOLE_MILK',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfMilkFeeding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalfWeightRecord" (
    "id" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "measuredDate" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfWeightRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalfStarterFeedRecord" (
    "id" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "eventType" "CalfStarterEventType" NOT NULL,
    "amountG" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfStarterFeedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalfWeaningRecord" (
    "id" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "weaningDate" TIMESTAMP(3) NOT NULL,
    "weaningWeightKg" DOUBLE PRECISION,
    "adgAtWeaning" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfWeaningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalfColostrumRecord_calfId_idx" ON "CalfColostrumRecord"("calfId");

-- CreateIndex
CREATE INDEX "CalfMilkFeeding_calfId_idx" ON "CalfMilkFeeding"("calfId");

-- CreateIndex
CREATE INDEX "CalfMilkFeeding_calfId_date_idx" ON "CalfMilkFeeding"("calfId", "date");

-- CreateIndex
CREATE INDEX "CalfWeightRecord_calfId_idx" ON "CalfWeightRecord"("calfId");

-- CreateIndex
CREATE INDEX "CalfWeightRecord_calfId_measuredDate_idx" ON "CalfWeightRecord"("calfId", "measuredDate");

-- CreateIndex
CREATE INDEX "CalfStarterFeedRecord_calfId_idx" ON "CalfStarterFeedRecord"("calfId");

-- CreateIndex
CREATE UNIQUE INDEX "CalfWeaningRecord_calfId_key" ON "CalfWeaningRecord"("calfId");

-- AddForeignKey
ALTER TABLE "CalfColostrumRecord" ADD CONSTRAINT "CalfColostrumRecord_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalfMilkFeeding" ADD CONSTRAINT "CalfMilkFeeding_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalfWeightRecord" ADD CONSTRAINT "CalfWeightRecord_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalfStarterFeedRecord" ADD CONSTRAINT "CalfStarterFeedRecord_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalfWeaningRecord" ADD CONSTRAINT "CalfWeaningRecord_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
