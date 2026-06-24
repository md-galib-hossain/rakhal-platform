-- CreateEnum
CREATE TYPE "FinanceTxnType" AS ENUM ('OPERATING_EXPENSE', 'INVENTORY_PURCHASE', 'REVENUE', 'DEBT_LOAN');

-- CreateEnum
CREATE TYPE "FinanceCategory" AS ENUM ('REVENUE', 'INVENTORY', 'HEALTHCARE', 'OVERHEAD', 'DEBT');

-- CreateEnum
CREATE TYPE "FinancePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MFS');

-- CreateEnum
CREATE TYPE "FinancePaymentType" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FinanceTxnStatus" AS ENUM ('COMPLETED', 'PENDING', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReceivableKind" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "FinanceTxnType" NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "subType" TEXT,
    "entityName" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidNow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentType" "FinancePaymentType" NOT NULL DEFAULT 'FULL',
    "paymentMethod" "FinancePaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "FinanceTxnStatus" NOT NULL DEFAULT 'COMPLETED',
    "buyerId" TEXT,
    "cattleId" TEXT,
    "inventoryItemName" TEXT,
    "quantity" DOUBLE PRECISION,
    "costPerUnit" DOUBLE PRECISION,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "reversedTransactionId" TEXT,
    "reversalReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceivable" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "ReceivableKind" NOT NULL,
    "entityName" TEXT,
    "total" DOUBLE PRECISION NOT NULL,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "sourceTransactionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLoan" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyEmi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "direction" "WalletDirection" NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "FinancePaymentMethod" NOT NULL DEFAULT 'CASH',
    "date" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceTransaction_farmId_idx" ON "FinanceTransaction"("farmId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_farmId_date_idx" ON "FinanceTransaction"("farmId", "date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_farmId_type_idx" ON "FinanceTransaction"("farmId", "type");

-- CreateIndex
CREATE INDEX "FinanceTransaction_farmId_status_idx" ON "FinanceTransaction"("farmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_farmId_reference_key" ON "FinanceTransaction"("farmId", "reference");

-- CreateIndex
CREATE INDEX "FinanceReceivable_farmId_idx" ON "FinanceReceivable"("farmId");

-- CreateIndex
CREATE INDEX "FinanceReceivable_farmId_kind_idx" ON "FinanceReceivable"("farmId", "kind");

-- CreateIndex
CREATE INDEX "FinanceReceivable_farmId_status_idx" ON "FinanceReceivable"("farmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivable_farmId_reference_key" ON "FinanceReceivable"("farmId", "reference");

-- CreateIndex
CREATE INDEX "FinanceLoan_farmId_idx" ON "FinanceLoan"("farmId");

-- CreateIndex
CREATE INDEX "FinanceLoan_farmId_status_idx" ON "FinanceLoan"("farmId", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_farmId_idx" ON "WalletTransaction"("farmId");

-- CreateIndex
CREATE INDEX "WalletTransaction_farmId_date_idx" ON "WalletTransaction"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_farmId_reference_key" ON "WalletTransaction"("farmId", "reference");

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivable" ADD CONSTRAINT "FinanceReceivable_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLoan" ADD CONSTRAINT "FinanceLoan_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
