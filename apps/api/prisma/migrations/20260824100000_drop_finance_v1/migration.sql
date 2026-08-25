-- RAKHAL-354 — Delete Finance V1 (`FINANCE_V2_DESIGN.md` §5.3).
-- Hand-authored (same precedent as every prior migration on this board —
-- `prisma migrate dev`/`diff` both refuse non-interactively in this
-- environment). `prisma migrate diff --from-config-datasource --to-schema
-- prisma --script` output was clean except two pieces of unrelated,
-- already-documented pre-existing drift, both excluded here per the same
-- precedent every prior hand-authored migration on this board follows:
--   1. `SafetyWithdrawalStatus` enum-value-order rename (RD-054).
--   2. `IncomeCategory_farmId_fkey` FK-action drop+recreate (unrelated to
--      this ticket's schema edits, not touched by this diff's own changes).
--
-- Drops the V1 Finance ledger/settlements/wallet (`FinanceTransaction`,
-- `FinanceReceivable`, `WalletTransaction`) and their now-unused enums.
-- `FinanceLoan`/`FixedAsset` are NOT touched — kept per `FINANCE_V2_DESIGN.md`
-- §5.2's "survives, re-pointed" intent (re-pointing never happened across the
-- whole milestone, so they stay on their existing V1-era columns; see
-- `finance/finance.prisma`'s own doc comment for the full reasoning).
--
-- `BreedingEvent.paymentMethod` moves from the dropped V1 `FinancePaymentMethod`
-- enum to Finance V2's own `PaymentMethod` (already WALLET-less). Converted via
-- a real enum swap (not drop+add) so existing CASH/BANK_TRANSFER/MFS rows
-- survive; any legacy `WALLET` row (dev/seed data only — this repo's `pnpm
-- seed` is the sole source of truth, per `FINANCE_V2_DESIGN.md` §2's "drop and
-- rebuild" decision for legacy data) is nulled out rather than silently
-- miscast, since V2 has no WALLET-equivalent value to map it to.

-- DropForeignKey
ALTER TABLE "FinanceReceivable" DROP CONSTRAINT "FinanceReceivable_farmId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceTransaction" DROP CONSTRAINT "FinanceTransaction_farmId_fkey";

-- DropForeignKey
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_farmId_fkey";

-- DropTable
DROP TABLE "FinanceReceivable";

-- DropTable
DROP TABLE "FinanceTransaction";

-- DropTable
DROP TABLE "WalletTransaction";

-- AlterTable: BreedingEvent.paymentMethod, V1 FinancePaymentMethod -> V2 PaymentMethod
ALTER TABLE "BreedingEvent" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "BreedingEvent"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING (
    CASE "paymentMethod"::text
      WHEN 'WALLET' THEN NULL
      ELSE "paymentMethod"::text
    END
  )::"PaymentMethod";

-- AlterTable: Expense.cattleId (new, RAKHAL-354 precondition for migrating
-- RAKHAL-330's breeding-cost posting off V1 onto a real V2 Expense with a
-- per-animal join).
ALTER TABLE "Expense" ADD COLUMN "cattleId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_farmId_cattleId_idx" ON "Expense"("farmId", "cattleId");

-- DropEnum
DROP TYPE "FinanceCategory";

-- DropEnum
DROP TYPE "FinancePaymentMethod";

-- DropEnum
DROP TYPE "FinancePaymentType";

-- DropEnum
DROP TYPE "FinanceTxnStatus";

-- DropEnum
DROP TYPE "FinanceTxnType";

-- DropEnum
DROP TYPE "ReceivableKind";

-- DropEnum
DROP TYPE "ReceivableStatus";

-- DropEnum
DROP TYPE "WalletDirection";
