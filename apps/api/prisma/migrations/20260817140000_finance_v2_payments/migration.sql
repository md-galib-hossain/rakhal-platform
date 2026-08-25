-- RAKHAL-337: Finance V2 Payment + PaymentAllocation (`FINANCE_V2_DESIGN.md`
-- §4.5, §4.6, §6).
-- Hand-authored: `prisma migrate diff` against the live dev datasource
-- returned a full-schema drop/recreate (unrelated to this ticket's actual
-- delta — the dev DB's FK constraint names don't match Prisma's expected
-- naming for several older tables), so this migration is written directly
-- from the schema instead, following the exact `CREATE TYPE`/`CREATE TABLE`/
-- `CREATE INDEX`/`ADD CONSTRAINT` shape of the immediately preceding
-- finance-v2 migrations (`20260817130000_finance_v2_financial_accounts` and
-- earlier). Applied via `migrate deploy`, not `migrate dev` (refuses
-- non-interactively in this environment, same precedent as every other
-- hand-authored migration on this board).

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MFS');

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receivableId" TEXT,
    "payableId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancePayment_farmId_idx" ON "FinancePayment"("farmId");

-- CreateIndex
CREATE INDEX "FinancePayment_farmId_financialAccountId_idx" ON "FinancePayment"("farmId", "financialAccountId");

-- CreateIndex
CREATE INDEX "FinancePayment_farmId_transactionDate_idx" ON "FinancePayment"("farmId", "transactionDate");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_receivableId_idx" ON "PaymentAllocation"("receivableId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_payableId_idx" ON "PaymentAllocation"("payableId");

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
