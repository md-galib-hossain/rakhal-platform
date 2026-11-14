-- RAKHAL-348: Purchasing module (Purchase/PurchaseLine, Expense, Payable),
-- plus the PaymentAllocation.payableId real @relation. Hand-authored via
-- `prisma migrate diff --from-config-datasource --to-schema --script`,
-- trimmed to exclude two unrelated diffs present in the live dev DB at diff
-- time: the same pre-existing `SafetyWithdrawalStatus` enum-drop (RD-054)
-- every prior hand-authored migration on this board excludes, and a
-- `IncomeCategory_farmId_fkey` drop+recreate that is RAKHAL-350's own
-- concurrent uncommitted schema (unrelated to this ticket, left for that
-- migration to reconcile). Applied via `migrate deploy` (`migrate dev`
-- refuses non-interactively in this environment, same precedent as every
-- other finance-v2/sales/purchasing migration on this board).

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'UTILITIES', 'BREEDING', 'TRANSFER_FEE', 'DEPRECIATION');

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "expenseId" TEXT,
    "supplierId" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "medicineId" TEXT,
    "feedItemId" TEXT,
    "equipmentId" TEXT,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "financialAccountId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payable_purchaseId_key" ON "Payable"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Payable_expenseId_key" ON "Payable"("expenseId");

-- CreateIndex
CREATE INDEX "Payable_farmId_idx" ON "Payable"("farmId");

-- CreateIndex
CREATE INDEX "Payable_farmId_supplierId_idx" ON "Payable"("farmId", "supplierId");

-- CreateIndex
CREATE INDEX "Payable_farmId_dueDate_idx" ON "Payable"("farmId", "dueDate");

-- CreateIndex
CREATE INDEX "Purchase_farmId_idx" ON "Purchase"("farmId");

-- CreateIndex
CREATE INDEX "Purchase_farmId_purchaseDate_idx" ON "Purchase"("farmId", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_farmId_supplierId_idx" ON "Purchase"("farmId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_farmId_purchaseNumber_key" ON "Purchase"("farmId", "purchaseNumber");

-- CreateIndex
CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseLine_medicineId_idx" ON "PurchaseLine"("medicineId");

-- CreateIndex
CREATE INDEX "PurchaseLine_feedItemId_idx" ON "PurchaseLine"("feedItemId");

-- CreateIndex
CREATE INDEX "PurchaseLine_equipmentId_idx" ON "PurchaseLine"("equipmentId");

-- CreateIndex
CREATE INDEX "Expense_farmId_idx" ON "Expense"("farmId");

-- CreateIndex
CREATE INDEX "Expense_farmId_expenseDate_idx" ON "Expense"("farmId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_farmId_category_idx" ON "Expense"("farmId", "category");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
