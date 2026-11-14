-- RAKHAL-340: Finance V2 `Receivable` — outstanding + status derived
-- (`FINANCE_V2_DESIGN.md` §4.3, §4.6).
-- Hand-authored, same precedent as every other finance-v2 migration on this
-- board (`prisma migrate diff` against the shared dev datasource returns a
-- full-schema drop/recreate unrelated to this ticket's actual delta) —
-- applied via `migrate deploy`, not `migrate dev`.
--
-- Closes RAKHAL-337's `TODO(RAKHAL-340)`: `PaymentAllocation.receivableId`
-- gains a real foreign key to the new `Receivable` table. `payableId` stays
-- a plain column (`TODO(RAKHAL-348)` still open).

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receivable_saleId_key" ON "Receivable"("saleId");

-- CreateIndex
CREATE INDEX "Receivable_farmId_idx" ON "Receivable"("farmId");

-- CreateIndex
CREATE INDEX "Receivable_farmId_customerId_idx" ON "Receivable"("farmId", "customerId");

-- CreateIndex
CREATE INDEX "Receivable_farmId_dueDate_idx" ON "Receivable"("farmId", "dueDate");

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
