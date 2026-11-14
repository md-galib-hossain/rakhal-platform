-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'MFS');

-- CreateEnum
CREATE TYPE "MfsProvider" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'OTHER');

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccountDetail" (
    "id" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfsAccountDetail" (
    "id" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "provider" "MfsProvider" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "accountType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfsAccountDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialAccount_farmId_idx" ON "FinancialAccount"("farmId");

-- CreateIndex
CREATE INDEX "FinancialAccount_farmId_type_idx" ON "FinancialAccount"("farmId", "type");

-- CreateIndex
CREATE INDEX "FinancialAccount_ledgerAccountId_idx" ON "FinancialAccount"("ledgerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccountDetail_financialAccountId_key" ON "BankAccountDetail"("financialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MfsAccountDetail_financialAccountId_key" ON "MfsAccountDetail"("financialAccountId");

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccountDetail" ADD CONSTRAINT "BankAccountDetail_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfsAccountDetail" ADD CONSTRAINT "MfsAccountDetail_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
