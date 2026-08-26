-- RAKHAL-365 (MILESTONE 22): promote Purchase.supplierId / Payable.supplierId
-- from plain scalars to real Supplier FKs; add new Expense.supplierId;
-- add Supplier.paymentTermsDays. Hand-authored (see RAKHAL-364's own
-- migration for the house convention this follows) — `prisma migrate diff`
-- against the live dev DB also reports two unrelated pre-existing drifts
-- (SafetyWithdrawalStatus enum reorder = RD-054, IncomeCategory FK action)
-- deliberately excluded here.
--
-- No backfill step is needed: live dev DB has 0/49 Purchase rows and 0/52
-- Payable rows with supplierId set (verified before writing this file), and
-- Expense.supplierId is a brand-new column with no prior data to reconcile.

-- 1. New column: Supplier.paymentTermsDays (numeric due-date offset,
--    coexists with the existing free-text paymentTerms column — RD-068).
ALTER TABLE "Supplier" ADD COLUMN "paymentTermsDays" INTEGER NOT NULL DEFAULT 0;

-- 2. New column: Expense.supplierId (did not exist before this ticket).
ALTER TABLE "Expense" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "Expense_farmId_supplierId_idx" ON "Expense"("farmId", "supplierId");

-- 3. Promote Purchase.supplierId / Payable.supplierId to real FKs.
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payable" ADD CONSTRAINT "Payable_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
