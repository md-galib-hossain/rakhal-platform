-- RAKHAL-280: generic AnimalHold mechanism. Purely additive — new enum + new
-- table, no existing columns/tables touched, no data migration needed.

-- CreateEnum
CREATE TYPE "AnimalHoldType" AS ENUM ('REPRODUCTIVE', 'MILK_DISCARD', 'QUARANTINE', 'OTHER');

-- CreateTable
CREATE TABLE "AnimalHold" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "type" "AnimalHoldType" NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "releasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalHold_farmId_cattleId_idx" ON "AnimalHold"("farmId", "cattleId");

-- CreateIndex
CREATE INDEX "AnimalHold_farmId_type_idx" ON "AnimalHold"("farmId", "type");

-- CreateIndex
CREATE INDEX "AnimalHold_cattleId_endedAt_idx" ON "AnimalHold"("cattleId", "endedAt");
