-- CreateEnum
CREATE TYPE "MilkSession" AS ENUM ('MORNING', 'NOON', 'EVENING', 'NIGHT');

-- CreateTable
CREATE TABLE "MilkLogEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "session" "MilkSession" NOT NULL,
    "yieldL" DOUBLE PRECISION NOT NULL,
    "tankType" "MilkTankType" NOT NULL DEFAULT 'SELLABLE',
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "anomalyNote" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewAction" TEXT,
    "reviewNote" TEXT,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "editReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilkLogEntry_farmId_idx" ON "MilkLogEntry"("farmId");

-- CreateIndex
CREATE INDEX "MilkLogEntry_farmId_logDate_idx" ON "MilkLogEntry"("farmId", "logDate");

-- CreateIndex
CREATE INDEX "MilkLogEntry_farmId_logDate_session_idx" ON "MilkLogEntry"("farmId", "logDate", "session");

-- CreateIndex
CREATE INDEX "MilkLogEntry_farmId_anomalyFlag_idx" ON "MilkLogEntry"("farmId", "anomalyFlag");

-- CreateIndex
CREATE INDEX "MilkLogEntry_cattleId_idx" ON "MilkLogEntry"("cattleId");

-- CreateIndex
CREATE UNIQUE INDEX "MilkLogEntry_cattleId_logDate_session_key" ON "MilkLogEntry"("cattleId", "logDate", "session");

-- AddForeignKey
ALTER TABLE "MilkLogEntry" ADD CONSTRAINT "MilkLogEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkLogEntry" ADD CONSTRAINT "MilkLogEntry_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
