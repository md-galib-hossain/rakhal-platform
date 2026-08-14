-- RAKHAL-326: Inventory Unit catalog (additive step 1/2).
-- Hand-authored (same precedent as prior tickets on this board — `prisma migrate dev`
-- and `--create-only` both refuse non-interactively in this environment). Generated via
-- `prisma migrate diff --from-config-datasource --to-schema ./prisma --script`, with the
-- unrelated pre-existing `SafetyWithdrawalStatus` enum-value-drop (RD-054, documented,
-- out of this ticket's lane) deliberately excluded, same as RAKHAL-298's migration.
--
-- Adds the new `Unit` catalog table + nullable `unitId` FK columns on Medicine/Equipment/
-- Forage(FeedItem), alongside the existing free-text `unit` column (kept, unchanged) so
-- `prisma/backfill-unit-catalog.ts` can populate `unitId` before a follow-up migration makes
-- it required (Medicine/FeedItem) and drops the legacy `unit` column.

-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Forage" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "conversionToBase" DOUBLE PRECISION,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "farmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unit_farmId_idx" ON "Unit"("farmId");

-- CreateIndex
CREATE INDEX "Unit_dimension_idx" ON "Unit"("dimension");

-- CreateIndex
CREATE INDEX "Equipment_unitId_idx" ON "Equipment"("unitId");

-- CreateIndex
CREATE INDEX "Forage_unitId_idx" ON "Forage"("unitId");

-- CreateIndex
CREATE INDEX "Medicine_unitId_idx" ON "Medicine"("unitId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forage" ADD CONSTRAINT "Forage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
