-- RAKHAL-338: Finance V2 Transfer (`FINANCE_V2_DESIGN.md` §4.4, §6).
-- Hand-authored following the exact precedent of the immediately preceding
-- finance-v2 migrations (`20260817140000_finance_v2_payments` and earlier):
-- `prisma migrate diff` against the live dev datasource has repeatedly
-- returned an anomalous full-schema drop/recreate on this environment
-- (unrelated FK-naming mismatch on several long-standing tables, not this
-- ticket's actual delta), so this migration is written directly from the
-- schema instead. Applied via `migrate deploy`, not `migrate dev` (refuses
-- non-interactively in this environment, same precedent as every other
-- hand-authored migration on this board).

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fromFinancialAccountId" TEXT NOT NULL,
    "toFinancialAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfer_farmId_idx" ON "Transfer"("farmId");

-- CreateIndex
CREATE INDEX "Transfer_farmId_fromFinancialAccountId_idx" ON "Transfer"("farmId", "fromFinancialAccountId");

-- CreateIndex
CREATE INDEX "Transfer_farmId_toFinancialAccountId_idx" ON "Transfer"("farmId", "toFinancialAccountId");

-- CreateIndex
CREATE INDEX "Transfer_farmId_transactionDate_idx" ON "Transfer"("farmId", "transactionDate");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromFinancialAccountId_fkey" FOREIGN KEY ("fromFinancialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toFinancialAccountId_fkey" FOREIGN KEY ("toFinancialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
