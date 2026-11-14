-- CreateEnum
CREATE TYPE "ReproductiveStatus" AS ENUM ('HEIFER', 'OPEN', 'BRED', 'PREGNANT', 'DRY', 'LACTATING', 'POSTPARTUM', 'ABORTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "HeatDetectionMethod" AS ENUM ('VISUAL', 'COLLAR_SENSOR', 'PEDOMETER', 'MANUAL');

-- CreateEnum
CREATE TYPE "BreedingMethod" AS ENUM ('AI', 'NATURAL', 'EMBRYO_TRANSFER');

-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('PENDING_CHECK', 'PREGNANT', 'FAILED', 'ABORTED', 'CALVED');

-- CreateEnum
CREATE TYPE "PregnancyDiagnosisResult" AS ENUM ('PREGNANT', 'NOT_PREGNANT', 'SUSPECTED');

-- CreateEnum
CREATE TYPE "PregnancyDiagnosisMethod" AS ENUM ('ULTRASOUND', 'PALPATION', 'LAB');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('ACTIVE', 'CALVED', 'ABORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CalvingEase" AS ENUM ('NORMAL', 'ASSISTED', 'DIFFICULT', 'CESAREAN');

-- CreateEnum
CREATE TYPE "CalfBirthStatus" AS ENUM ('ALIVE', 'STILLBORN', 'DIED_AFTER_BIRTH');

-- CreateEnum
CREATE TYPE "LactationStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "ReproductionProfile" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "pubertyDate" TIMESTAMP(3),
    "reproductiveStatus" "ReproductiveStatus" NOT NULL DEFAULT 'HEIFER',
    "currentLactationNumber" INTEGER NOT NULL DEFAULT 0,
    "totalBreedings" INTEGER NOT NULL DEFAULT 0,
    "totalPregnancies" INTEGER NOT NULL DEFAULT 0,
    "totalCalvings" INTEGER NOT NULL DEFAULT 0,
    "totalAbortions" INTEGER NOT NULL DEFAULT 0,
    "firstCalvingDate" TIMESTAMP(3),
    "lastBreedingDate" TIMESTAMP(3),
    "lastPregnancyCheckDate" TIMESTAMP(3),
    "lastCalvingDate" TIMESTAMP(3),
    "currentPregnancyId" TEXT,
    "currentLactationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproductionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeatEvent" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "heatDateTime" TIMESTAMP(3) NOT NULL,
    "detectionMethod" "HeatDetectionMethod" NOT NULL,
    "standingHeat" BOOLEAN NOT NULL DEFAULT false,
    "mucusDischarge" BOOLEAN NOT NULL DEFAULT false,
    "mountingBehavior" BOOLEAN NOT NULL DEFAULT false,
    "restlessness" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingEvent" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "breedingDate" TIMESTAMP(3) NOT NULL,
    "breedingMethod" "BreedingMethod" NOT NULL,
    "bullId" TEXT,
    "semenBatchId" TEXT,
    "inseminator" TEXT,
    "breedingNumber" INTEGER NOT NULL,
    "expectedPregnancyCheckDate" TIMESTAMP(3),
    "status" "BreedingStatus" NOT NULL DEFAULT 'PENDING_CHECK',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyDiagnosis" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "breedingEventId" TEXT,
    "diagnosisDate" TIMESTAMP(3) NOT NULL,
    "result" "PregnancyDiagnosisResult" NOT NULL,
    "diagnosisMethod" "PregnancyDiagnosisMethod" NOT NULL,
    "gestationDay" INTEGER,
    "expectedCalvingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PregnancyDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pregnancy" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "breedingEventId" TEXT,
    "conceptionDate" TIMESTAMP(3) NOT NULL,
    "expectedCalvingDate" TIMESTAMP(3),
    "actualCalvingDate" TIMESTAMP(3),
    "gestationDays" INTEGER,
    "status" "PregnancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalvingEvent" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "pregnancyId" TEXT,
    "calvingDate" TIMESTAMP(3) NOT NULL,
    "calvingNumber" INTEGER NOT NULL,
    "calvingEase" "CalvingEase" NOT NULL,
    "calfCount" INTEGER NOT NULL DEFAULT 1,
    "placentaExpelled" BOOLEAN NOT NULL DEFAULT false,
    "retainedPlacenta" BOOLEAN NOT NULL DEFAULT false,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalvingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalfBirth" (
    "id" TEXT NOT NULL,
    "calvingEventId" TEXT NOT NULL,
    "calfId" TEXT,
    "gender" "CattleGender" NOT NULL,
    "birthWeight" DECIMAL(65,30),
    "status" "CalfBirthStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalfBirth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbortionEvent" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "pregnancyId" TEXT,
    "abortionDate" TIMESTAMP(3) NOT NULL,
    "gestationDay" INTEGER,
    "suspectedCause" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbortionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DryPeriod" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DryPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lactation" (
    "id" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "lactationNumber" INTEGER NOT NULL,
    "calvingEventId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "peakMilkDate" TIMESTAMP(3),
    "status" "LactationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lactation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReproductionProfile_cattleId_key" ON "ReproductionProfile"("cattleId");

-- CreateIndex
CREATE INDEX "HeatEvent_cattleId_idx" ON "HeatEvent"("cattleId");
CREATE INDEX "HeatEvent_heatDateTime_idx" ON "HeatEvent"("heatDateTime");

-- CreateIndex
CREATE INDEX "BreedingEvent_cattleId_idx" ON "BreedingEvent"("cattleId");
CREATE INDEX "BreedingEvent_bullId_idx" ON "BreedingEvent"("bullId");
CREATE INDEX "BreedingEvent_breedingDate_idx" ON "BreedingEvent"("breedingDate");
CREATE INDEX "BreedingEvent_status_idx" ON "BreedingEvent"("status");

-- CreateIndex
CREATE INDEX "PregnancyDiagnosis_cattleId_idx" ON "PregnancyDiagnosis"("cattleId");
CREATE INDEX "PregnancyDiagnosis_breedingEventId_idx" ON "PregnancyDiagnosis"("breedingEventId");
CREATE INDEX "PregnancyDiagnosis_diagnosisDate_idx" ON "PregnancyDiagnosis"("diagnosisDate");
CREATE INDEX "PregnancyDiagnosis_result_idx" ON "PregnancyDiagnosis"("result");

-- CreateIndex
CREATE INDEX "Pregnancy_cattleId_idx" ON "Pregnancy"("cattleId");
CREATE INDEX "Pregnancy_breedingEventId_idx" ON "Pregnancy"("breedingEventId");
CREATE INDEX "Pregnancy_status_idx" ON "Pregnancy"("status");

-- CreateIndex
CREATE INDEX "CalvingEvent_cattleId_idx" ON "CalvingEvent"("cattleId");
CREATE INDEX "CalvingEvent_pregnancyId_idx" ON "CalvingEvent"("pregnancyId");
CREATE INDEX "CalvingEvent_calvingDate_idx" ON "CalvingEvent"("calvingDate");

-- CreateIndex
CREATE INDEX "CalfBirth_calvingEventId_idx" ON "CalfBirth"("calvingEventId");
CREATE INDEX "CalfBirth_calfId_idx" ON "CalfBirth"("calfId");

-- CreateIndex
CREATE INDEX "AbortionEvent_cattleId_idx" ON "AbortionEvent"("cattleId");
CREATE INDEX "AbortionEvent_pregnancyId_idx" ON "AbortionEvent"("pregnancyId");
CREATE INDEX "AbortionEvent_abortionDate_idx" ON "AbortionEvent"("abortionDate");

-- CreateIndex
CREATE INDEX "DryPeriod_cattleId_idx" ON "DryPeriod"("cattleId");
CREATE INDEX "DryPeriod_startDate_idx" ON "DryPeriod"("startDate");

-- CreateIndex
CREATE INDEX "Lactation_cattleId_idx" ON "Lactation"("cattleId");
CREATE INDEX "Lactation_calvingEventId_idx" ON "Lactation"("calvingEventId");
CREATE INDEX "Lactation_status_idx" ON "Lactation"("status");

-- AddForeignKey
ALTER TABLE "ReproductionProfile" ADD CONSTRAINT "ReproductionProfile_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeatEvent" ADD CONSTRAINT "HeatEvent_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_bullId_fkey" FOREIGN KEY ("bullId") REFERENCES "Cattle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PregnancyDiagnosis" ADD CONSTRAINT "PregnancyDiagnosis_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PregnancyDiagnosis" ADD CONSTRAINT "PregnancyDiagnosis_breedingEventId_fkey" FOREIGN KEY ("breedingEventId") REFERENCES "BreedingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_breedingEventId_fkey" FOREIGN KEY ("breedingEventId") REFERENCES "BreedingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalvingEvent" ADD CONSTRAINT "CalvingEvent_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalvingEvent" ADD CONSTRAINT "CalvingEvent_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalfBirth" ADD CONSTRAINT "CalfBirth_calvingEventId_fkey" FOREIGN KEY ("calvingEventId") REFERENCES "CalvingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalfBirth" ADD CONSTRAINT "CalfBirth_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Cattle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbortionEvent" ADD CONSTRAINT "AbortionEvent_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbortionEvent" ADD CONSTRAINT "AbortionEvent_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DryPeriod" ADD CONSTRAINT "DryPeriod_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lactation" ADD CONSTRAINT "Lactation_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lactation" ADD CONSTRAINT "Lactation_calvingEventId_fkey" FOREIGN KEY ("calvingEventId") REFERENCES "CalvingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
