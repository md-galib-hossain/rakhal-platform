-- CreateEnum
CREATE TYPE "HealthDiagnosisType" AS ENUM ('DISEASE', 'INJURY', 'VACCINATION', 'DEWORMING', 'ROUTINE_CHECKUP', 'PREVENTIVE', 'BREEDING_RELATED', 'OTHER');

-- CreateEnum
CREATE TYPE "HealthPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthCaseStatus" AS ENUM ('ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE', 'RECOVERED', 'MORTALITY', 'CLOSED');

-- CreateEnum
CREATE TYPE "HealthPlanCategory" AS ENUM ('TREATMENT', 'PREVENTION', 'BREEDING', 'VACCINATION', 'DEWORMING', 'ROUTINE');

-- CreateEnum
CREATE TYPE "HealthPlanType" AS ENUM ('MEDICAL', 'PREVENTION', 'BREEDING', 'GENERAL');

-- CreateEnum
CREATE TYPE "HealthActionType" AS ENUM ('MEDICINE', 'OBSERVATION', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'LAB_TEST', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicineRoute" AS ENUM ('IM', 'IV', 'SC', 'ORAL', 'TOPICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "HealthTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED', 'OVERDUE', 'SKIPPED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ClinicalProgress" AS ENUM ('IMPROVING', 'WORSENING', 'STABLE');

-- CreateEnum
CREATE TYPE "AppetiteStatus" AS ENUM ('NORMAL', 'REDUCED', 'NONE', 'HIGH');

-- CreateEnum
CREATE TYPE "AppearanceStatus" AS ENUM ('BRIGHT', 'DULL', 'DEPRESSED', 'WEAK');

-- CreateEnum
CREATE TYPE "SafetyWithdrawalStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HealthCloseOutcome" AS ENUM ('RECOVERED', 'MORTALITY');

-- CreateTable
CREATE TABLE "HealthCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "diagnosisType" "HealthDiagnosisType" NOT NULL,
    "priority" "HealthPriority" NOT NULL,
    "status" "HealthCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "shedId" TEXT,
    "shedName" TEXT,
    "reportedBy" TEXT,
    "assignedVet" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedRecoveryDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "closeReason" TEXT,
    "mortalityId" TEXT,
    "healthPlanId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "symptoms" TEXT[],
    "notes" TEXT,
    "isSafetyWithholdingActive" BOOLEAN NOT NULL DEFAULT false,
    "milkWithdrawalUntil" TIMESTAMP(3),
    "meatWithdrawalUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "HealthPlanCategory" NOT NULL,
    "planType" "HealthPlanType" NOT NULL,
    "description" TEXT,
    "diagnosis" TEXT,
    "cycleLengthDays" INTEGER,
    "totalActionSteps" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(65,30),
    "currentlyActiveAnimalCount" INTEGER NOT NULL DEFAULT 0,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthPlanStep" (
    "id" TEXT NOT NULL,
    "healthPlanId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "actionType" "HealthActionType" NOT NULL,
    "medicineId" TEXT,
    "medicineName" TEXT,
    "doseAmount" DECIMAL(65,30),
    "doseUnit" TEXT,
    "route" "MedicineRoute",
    "instruction" TEXT,
    "estimatedTime" TEXT,
    "milkWithdrawalDays" INTEGER,
    "meatWithdrawalDays" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthCaseId" TEXT NOT NULL,
    "healthPlanId" TEXT,
    "taskCode" TEXT NOT NULL,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "dueDateTime" TIMESTAMP(3) NOT NULL,
    "status" "HealthTaskStatus" NOT NULL DEFAULT 'PENDING',
    "taskType" "HealthActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT,
    "stepNumber" INTEGER,
    "totalSteps" INTEGER,
    "medicineId" TEXT,
    "medicineName" TEXT,
    "doseAmount" DECIMAL(65,30),
    "doseUnit" TEXT,
    "route" "MedicineRoute",
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "rescheduledFrom" TIMESTAMP(3),
    "rescheduledTo" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthCaseId" TEXT NOT NULL,
    "healthTaskId" TEXT,
    "medicineId" TEXT,
    "medicineName" TEXT,
    "route" "MedicineRoute",
    "doseAmount" DECIMAL(65,30),
    "doseUnit" TEXT,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "stockDeductionQuantity" DECIMAL(65,30),
    "batchNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthUpdate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthCaseId" TEXT NOT NULL,
    "clinicalProgress" "ClinicalProgress" NOT NULL,
    "symptoms" TEXT[],
    "temperature" DECIMAL(65,30),
    "appetite" "AppetiteStatus",
    "appearance" "AppearanceStatus",
    "observation" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortalityRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthCaseId" TEXT NOT NULL,
    "deathDate" TIMESTAMP(3) NOT NULL,
    "primaryCauseOfDeath" TEXT NOT NULL,
    "vetSignOff" TEXT,
    "symptoms" TEXT[],
    "postMortemPerformed" BOOLEAN NOT NULL DEFAULT false,
    "disposalMethod" TEXT,
    "disposalCost" DECIMAL(65,30),
    "disposalLocation" TEXT,
    "additionalNotes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MortalityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyWithdrawal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthCaseId" TEXT NOT NULL,
    "treatmentLogId" TEXT,
    "medicineId" TEXT,
    "milkWithdrawalUntil" TIMESTAMP(3),
    "meatWithdrawalUntil" TIMESTAMP(3),
    "status" "SafetyWithdrawalStatus" NOT NULL DEFAULT 'ACTIVE',
    "safeMilkDate" TIMESTAMP(3),
    "safeMeatDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseCatalog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultPriority" "HealthPriority",
    "defaultSymptoms" TEXT[],
    "isContagious" BOOLEAN NOT NULL DEFAULT false,
    "recommendedIsolation" BOOLEAN NOT NULL DEFAULT false,
    "defaultMilkWithdrawalDays" INTEGER,
    "defaultMeatWithdrawalDays" INTEGER,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiseaseCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthCase_organizationId_cattleId_idx" ON "HealthCase"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "HealthCase_organizationId_status_idx" ON "HealthCase"("organizationId", "status");

-- CreateIndex
CREATE INDEX "HealthCase_organizationId_diagnosis_idx" ON "HealthCase"("organizationId", "diagnosis");

-- CreateIndex
CREATE INDEX "HealthCase_organizationId_priority_idx" ON "HealthCase"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "HealthCase_organizationId_startDate_idx" ON "HealthCase"("organizationId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "HealthCase_organizationId_caseCode_key" ON "HealthCase"("organizationId", "caseCode");

-- CreateIndex
CREATE INDEX "HealthPlan_organizationId_category_idx" ON "HealthPlan"("organizationId", "category");

-- CreateIndex
CREATE INDEX "HealthPlan_organizationId_name_idx" ON "HealthPlan"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HealthPlan_organizationId_name_key" ON "HealthPlan"("organizationId", "name");

-- CreateIndex
CREATE INDEX "HealthPlanStep_healthPlanId_idx" ON "HealthPlanStep"("healthPlanId");

-- CreateIndex
CREATE INDEX "HealthPlanStep_healthPlanId_dayNumber_idx" ON "HealthPlanStep"("healthPlanId", "dayNumber");

-- CreateIndex
CREATE INDEX "HealthTask_organizationId_dueDateTime_idx" ON "HealthTask"("organizationId", "dueDateTime");

-- CreateIndex
CREATE INDEX "HealthTask_organizationId_status_idx" ON "HealthTask"("organizationId", "status");

-- CreateIndex
CREATE INDEX "HealthTask_organizationId_cattleId_idx" ON "HealthTask"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "HealthTask_organizationId_healthCaseId_idx" ON "HealthTask"("organizationId", "healthCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthTask_organizationId_taskCode_key" ON "HealthTask"("organizationId", "taskCode");

-- CreateIndex
CREATE INDEX "TreatmentLog_organizationId_cattleId_idx" ON "TreatmentLog"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "TreatmentLog_organizationId_healthCaseId_idx" ON "TreatmentLog"("organizationId", "healthCaseId");

-- CreateIndex
CREATE INDEX "TreatmentLog_organizationId_administeredAt_idx" ON "TreatmentLog"("organizationId", "administeredAt");

-- CreateIndex
CREATE INDEX "HealthUpdate_organizationId_healthCaseId_idx" ON "HealthUpdate"("organizationId", "healthCaseId");

-- CreateIndex
CREATE INDEX "HealthUpdate_organizationId_cattleId_idx" ON "HealthUpdate"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "HealthUpdate_organizationId_recordedAt_idx" ON "HealthUpdate"("organizationId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MortalityRecord_healthCaseId_key" ON "MortalityRecord"("healthCaseId");

-- CreateIndex
CREATE INDEX "MortalityRecord_organizationId_cattleId_idx" ON "MortalityRecord"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "MortalityRecord_organizationId_healthCaseId_idx" ON "MortalityRecord"("organizationId", "healthCaseId");

-- CreateIndex
CREATE INDEX "MortalityRecord_organizationId_deathDate_idx" ON "MortalityRecord"("organizationId", "deathDate");

-- CreateIndex
CREATE INDEX "SafetyWithdrawal_organizationId_cattleId_idx" ON "SafetyWithdrawal"("organizationId", "cattleId");

-- CreateIndex
CREATE INDEX "SafetyWithdrawal_organizationId_status_idx" ON "SafetyWithdrawal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SafetyWithdrawal_organizationId_healthCaseId_idx" ON "SafetyWithdrawal"("organizationId", "healthCaseId");

-- CreateIndex
CREATE INDEX "DiseaseCatalog_organizationId_idx" ON "DiseaseCatalog"("organizationId");

-- CreateIndex
CREATE INDEX "DiseaseCatalog_name_idx" ON "DiseaseCatalog"("name");

-- AddForeignKey
ALTER TABLE "HealthCase" ADD CONSTRAINT "HealthCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCase" ADD CONSTRAINT "HealthCase_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCase" ADD CONSTRAINT "HealthCase_shedId_fkey" FOREIGN KEY ("shedId") REFERENCES "Shed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCase" ADD CONSTRAINT "HealthCase_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthPlan" ADD CONSTRAINT "HealthPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthPlan" ADD CONSTRAINT "HealthPlan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthPlanStep" ADD CONSTRAINT "HealthPlanStep_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLog" ADD CONSTRAINT "TreatmentLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLog" ADD CONSTRAINT "TreatmentLog_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLog" ADD CONSTRAINT "TreatmentLog_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentLog" ADD CONSTRAINT "TreatmentLog_healthTaskId_fkey" FOREIGN KEY ("healthTaskId") REFERENCES "HealthTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthUpdate" ADD CONSTRAINT "HealthUpdate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthUpdate" ADD CONSTRAINT "HealthUpdate_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthUpdate" ADD CONSTRAINT "HealthUpdate_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityRecord" ADD CONSTRAINT "MortalityRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityRecord" ADD CONSTRAINT "MortalityRecord_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityRecord" ADD CONSTRAINT "MortalityRecord_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyWithdrawal" ADD CONSTRAINT "SafetyWithdrawal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyWithdrawal" ADD CONSTRAINT "SafetyWithdrawal_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyWithdrawal" ADD CONSTRAINT "SafetyWithdrawal_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyWithdrawal" ADD CONSTRAINT "SafetyWithdrawal_treatmentLogId_fkey" FOREIGN KEY ("treatmentLogId") REFERENCES "TreatmentLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseCatalog" ADD CONSTRAINT "DiseaseCatalog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
