-- DropForeignKey
ALTER TABLE "IncomeCategory" DROP CONSTRAINT "IncomeCategory_farmId_fkey";

-- CreateTable
CREATE TABLE "FinancialDocument" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "journalTransactionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "partyId" TEXT,
    "partyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocument_journalTransactionId_key" ON "FinancialDocument"("journalTransactionId");

-- CreateIndex
CREATE INDEX "FinancialDocument_farmId_documentNumber_idx" ON "FinancialDocument"("farmId", "documentNumber");

-- CreateIndex
CREATE INDEX "FinancialDocument_farmId_sourceType_sourceId_idx" ON "FinancialDocument"("farmId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "FinancialDocument_farmId_partyName_idx" ON "FinancialDocument"("farmId", "partyName");

-- AddForeignKey
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDocument" ADD CONSTRAINT "FinancialDocument_journalTransactionId_fkey" FOREIGN KEY ("journalTransactionId") REFERENCES "JournalTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeCategory" ADD CONSTRAINT "IncomeCategory_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
