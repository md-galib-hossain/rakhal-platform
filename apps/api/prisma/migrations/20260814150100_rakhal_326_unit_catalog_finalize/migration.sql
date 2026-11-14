-- RAKHAL-326: Inventory Unit catalog (finalize step 2/2).
-- Hand-authored (same precedent as the additive migration and prior tickets on this
-- board). Generated via `prisma migrate diff --from-config-datasource --to-schema ./prisma
-- --script`, with the same unrelated pre-existing `SafetyWithdrawalStatus` enum-value-drop
-- (RD-054) deliberately excluded.
--
-- Run only after `prisma/backfill-unit-catalog.ts` has populated `unitId` on every
-- Medicine/Forage(FeedItem) row (Equipment.unitId stays optional, mirroring its old
-- optional `unit` column). Drops the legacy free-text `unit` column on all three tables
-- and makes Medicine.unitId/Forage.unitId required.

-- DropForeignKey
ALTER TABLE "Forage" DROP CONSTRAINT "Forage_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Medicine" DROP CONSTRAINT "Medicine_unitId_fkey";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "unit";

-- AlterTable
ALTER TABLE "Forage" DROP COLUMN "unit",
ALTER COLUMN "unitId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Medicine" DROP COLUMN "unit",
ALTER COLUMN "unitId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Forage" ADD CONSTRAINT "Forage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
