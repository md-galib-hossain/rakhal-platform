-- RAKHAL-350: Finance V2 `IncomeCategory` + `OtherIncome` — closes
-- "Manure and 'Other' do not exist as concepts" (`FINANCE_V2_DESIGN.md` §1.3,
-- §5.1). Hand-authored, same precedent as every other finance-v2 migration
-- on this board (`prisma migrate diff` against the shared dev datasource
-- returns a full-schema drop/recreate unrelated to this ticket's actual
-- delta) — applied via `migrate deploy`, not `migrate dev`.
--
-- `IncomeCategory.farmId` is nullable (system/global vs farm-custom), the
-- same convention as `Unit.farmId` (RAKHAL-326) — not the per-farm-seeded
-- convention `LedgerAccount` (RAKHAL-333) uses.

-- CreateTable
CREATE TABLE "IncomeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "farmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherIncome" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherIncome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeCategory_farmId_idx" ON "IncomeCategory"("farmId");

-- CreateIndex
CREATE INDEX "OtherIncome_farmId_idx" ON "OtherIncome"("farmId");

-- CreateIndex
CREATE INDEX "OtherIncome_farmId_date_idx" ON "OtherIncome"("farmId", "date");

-- CreateIndex
CREATE INDEX "OtherIncome_categoryId_idx" ON "OtherIncome"("categoryId");

-- CreateIndex
CREATE INDEX "OtherIncome_financialAccountId_idx" ON "OtherIncome"("financialAccountId");

-- AddForeignKey
ALTER TABLE "IncomeCategory" ADD CONSTRAINT "IncomeCategory_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncomeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
