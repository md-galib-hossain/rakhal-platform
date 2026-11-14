-- Record AI: explicit semen source (FARM_INVENTORY/TECHNICIAN_SUPPLIED/EXTERNAL) +
-- ServiceProvider directory (no ticket #, 2026-08-15).
-- Hand-authored (not `prisma migrate dev` output) to exclude the unrelated
-- pre-existing `SafetyWithdrawalStatus` enum-value-drop noise (RD-054, out of
-- this ticket's lane) that `prisma migrate diff` also reports, same pattern as
-- 20260814160000_rakhal_329_nutrition_source_enum and siblings.

-- CreateEnum
CREATE TYPE "SemenSource" AS ENUM ('FARM_INVENTORY', 'TECHNICIAN_SUPPLIED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "SemenType" AS ENUM ('CONVENTIONAL', 'SEXED');

-- CreateEnum
CREATE TYPE "ServiceProviderType" AS ENUM ('AI_TECHNICIAN', 'VETERINARIAN', 'OTHER');

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "type" "ServiceProviderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceProvider_farmId_idx" ON "ServiceProvider"("farmId");

-- CreateIndex
CREATE INDEX "ServiceProvider_farmId_isActive_idx" ON "ServiceProvider"("farmId", "isActive");

-- AlterTable: BreedingEvent gains explicit semen-source + progressive-optional
-- traceability fields, all nullable — no backfill needed, pre-existing rows
-- predate this concept.
ALTER TABLE "BreedingEvent"
  ADD COLUMN "semenSource" "SemenSource",
  ADD COLUMN "serviceProviderId" TEXT,
  ADD COLUMN "sireNameOrCode" TEXT,
  ADD COLUMN "sireBreed" TEXT,
  ADD COLUMN "semenType" "SemenType",
  ADD COLUMN "strawBatchCode" TEXT,
  ADD COLUMN "semenCompany" TEXT,
  ADD COLUMN "serviceCost" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "BreedingEvent_semenSource_idx" ON "BreedingEvent"("semenSource");

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingEvent" ADD CONSTRAINT "BreedingEvent_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
