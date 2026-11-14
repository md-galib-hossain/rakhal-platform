-- CreateEnum
CREATE TYPE "ReproStepType" AS ENUM ('GNRH', 'PGF2ALPHA', 'CIDR_INSERT', 'CIDR_REMOVE', 'AI', 'PREGNANCY_CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "ReproProtocolStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReproPregnancyOutcome" AS ENUM ('WAITING_PD', 'PREGNANT', 'OPEN', 'PREGNANCY_LOSS');

-- CreateTable
CREATE TABLE "ReproProtocol" (
    "id" TEXT NOT NULL,
    "farmId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 0,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReproProtocolStep" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "stepType" "ReproStepType" NOT NULL,
    "instruction" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReproProtocolStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReproProtocolInstance" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" "ReproProtocolStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStepDay" INTEGER,
    "aiCompletedAt" TIMESTAMP(3),
    "breedingEventId" TEXT,
    "pregnancyOutcome" "ReproPregnancyOutcome",
    "outcomeRecordedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproProtocolInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReproProtocol_farmId_idx" ON "ReproProtocol"("farmId");

-- CreateIndex
CREATE INDEX "ReproProtocol_isSystemDefault_idx" ON "ReproProtocol"("isSystemDefault");

-- CreateIndex
CREATE INDEX "ReproProtocolStep_protocolId_idx" ON "ReproProtocolStep"("protocolId");

-- CreateIndex
CREATE INDEX "ReproProtocolStep_protocolId_dayNumber_idx" ON "ReproProtocolStep"("protocolId", "dayNumber");

-- CreateIndex
CREATE INDEX "ReproProtocolInstance_farmId_idx" ON "ReproProtocolInstance"("farmId");

-- CreateIndex
CREATE INDEX "ReproProtocolInstance_farmId_protocolId_idx" ON "ReproProtocolInstance"("farmId", "protocolId");

-- CreateIndex
CREATE INDEX "ReproProtocolInstance_cattleId_idx" ON "ReproProtocolInstance"("cattleId");

-- CreateIndex
CREATE INDEX "ReproProtocolInstance_farmId_status_idx" ON "ReproProtocolInstance"("farmId", "status");

-- AddForeignKey
ALTER TABLE "ReproProtocol" ADD CONSTRAINT "ReproProtocol_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproProtocolStep" ADD CONSTRAINT "ReproProtocolStep_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "ReproProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproProtocolInstance" ADD CONSTRAINT "ReproProtocolInstance_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproProtocolInstance" ADD CONSTRAINT "ReproProtocolInstance_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "ReproProtocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
