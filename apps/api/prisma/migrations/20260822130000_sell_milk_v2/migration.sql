-- RAKHAL-342: `SellMilk` use case (fully atomic, Finance V2 —
-- `FINANCE_V2_DESIGN.md` §1.2, §4.3).
-- Hand-authored, same precedent as every other finance-v2/sales migration on
-- this board (`prisma migrate diff` against the shared dev datasource
-- returns a full-schema drop/recreate unrelated to this ticket's actual
-- delta) — applied via `migrate deploy`, not `migrate dev`.
--
-- Two additive, nullable, loose-reference columns (no FK — same
-- cross-module convention `MilkDispatch.financeTransactionId` already
-- established):
--   * `MilkTankAuditLog.saleLineId` — traces a SALE-activity tank decrement
--     back to the `SaleLine` whose atomic sale caused it.
--   * `MilkDispatch.saleId` — traces a dispatch to the V2 `Sale` its revenue
--     now posts to (replaces the V1 `financeTransactionId` linkage going
--     forward; that column is left in place, read-only, for history).

-- AlterTable
ALTER TABLE "MilkTankAuditLog" ADD COLUMN "saleLineId" TEXT;

-- CreateIndex
CREATE INDEX "MilkTankAuditLog_saleLineId_idx" ON "MilkTankAuditLog"("saleLineId");

-- AlterTable
ALTER TABLE "MilkDispatch" ADD COLUMN "saleId" TEXT;
