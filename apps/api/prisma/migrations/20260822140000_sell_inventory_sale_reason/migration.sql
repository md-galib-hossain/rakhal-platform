-- RAKHAL-346 — SellInventoryItem (stock-backed), `FINANCE_V2_DESIGN.md` §5.2.
-- Hand-authored (trimmed from `prisma migrate diff --from-config-datasource
-- prisma.config.ts --to-schema prisma --script`, `migrate dev` is
-- non-interactive here) to exclude two unrelated diffs present in the live
-- dev DB at diff time: the pre-existing `SafetyWithdrawalStatus` enum-drop
-- (RD-054) every prior hand-authored migration on this board excludes, and
-- other parallel agents' own in-progress uncommitted schema (RAKHAL-342's
-- `MilkDispatch.saleId`/`MilkTankAuditLog.saleLineId`, RAKHAL-350's
-- `IncomeCategory` FK) — deliberately left for those tickets' own migrations.

-- AlterEnum: SALE reason on the three inventory item stock-movement reasons.
ALTER TYPE "EquipmentStockMovementReason" ADD VALUE 'SALE';
ALTER TYPE "FeedItemStockMovementReason" ADD VALUE 'SALE';
ALTER TYPE "MedicineStockMovementReason" ADD VALUE 'SALE';

-- AlterTable: nullable saleLineId so a movement can name the sale that caused
-- it. Plain scalar, not a `@relation` — `sales/**` is a different ticket's
-- lane (same judgment call as `CattleDisposition.saleId`).
ALTER TABLE "EquipmentStockMovement" ADD COLUMN "saleLineId" TEXT;
ALTER TABLE "FeedItemStockMovement" ADD COLUMN "saleLineId" TEXT;
ALTER TABLE "MedicineStockMovement" ADD COLUMN "saleLineId" TEXT;

-- CreateIndex
CREATE INDEX "EquipmentStockMovement_saleLineId_idx" ON "EquipmentStockMovement"("saleLineId");
CREATE INDEX "FeedItemStockMovement_saleLineId_idx" ON "FeedItemStockMovement"("saleLineId");
CREATE INDEX "MedicineStockMovement_saleLineId_idx" ON "MedicineStockMovement"("saleLineId");
