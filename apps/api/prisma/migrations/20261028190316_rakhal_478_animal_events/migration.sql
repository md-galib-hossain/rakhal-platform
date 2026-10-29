-- CreateEnum
CREATE TYPE "AnimalEventType" AS ENUM ('HEAT', 'BREEDING', 'PREG_CHECK', 'CALVING', 'ABORTION', 'DRY_OFF', 'ILLNESS', 'TREATMENT', 'VACCINATION', 'DEWORMING', 'WEIGHT', 'BCS', 'WEANING', 'CASTRATION', 'ENTER_FATTENING', 'LEAVE_FATTENING', 'MOVE', 'SOLD', 'DIED', 'CULLED', 'NOTE', 'HOOF_TRIM', 'DEHORN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EventProvenance" AS ENUM ('RECORDED', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateTable
CREATE TABLE "AnimalEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "type" "AnimalEventType" NOT NULL,
    "customTypeId" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "dateApprox" BOOLEAN NOT NULL DEFAULT false,
    "provenance" "EventProvenance" NOT NULL DEFAULT 'RECORDED',
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "notes" TEXT,
    "data" JSONB,
    "findings" JSONB,
    "batchId" TEXT,
    "sourceEventId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalEventBatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "AnimalEventType" NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "requested" INTEGER NOT NULL,
    "saved" INTEGER NOT NULL,
    "skipped" JSONB,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalEventBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalEvent_farmId_cattleId_eventAt_id_idx" ON "AnimalEvent"("farmId", "cattleId", "eventAt", "id");

-- CreateIndex
CREATE INDEX "AnimalEvent_farmId_type_eventAt_idx" ON "AnimalEvent"("farmId", "type", "eventAt");

-- CreateIndex
CREATE INDEX "AnimalEvent_batchId_idx" ON "AnimalEvent"("batchId");

-- CreateIndex
CREATE INDEX "AnimalEventBatch_farmId_createdAt_idx" ON "AnimalEventBatch"("farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnimalEventBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEventBatch" ADD CONSTRAINT "AnimalEventBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
