-- CreateEnum
CREATE TYPE "JournalTransactionStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "JournalTransaction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JournalTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "reversalOfId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "journalTransactionId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalTransaction_farmId_sourceType_sourceId_idx" ON "JournalTransaction"("farmId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalTransaction_farmId_transactionDate_idx" ON "JournalTransaction"("farmId", "transactionDate");

-- CreateIndex
CREATE INDEX "JournalTransaction_reversalOfId_idx" ON "JournalTransaction"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTransaction_farmId_idempotencyKey_key" ON "JournalTransaction"("farmId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "JournalEntry_journalTransactionId_idx" ON "JournalEntry"("journalTransactionId");

-- CreateIndex
CREATE INDEX "JournalEntry_ledgerAccountId_idx" ON "JournalEntry"("ledgerAccountId");

-- AddForeignKey
ALTER TABLE "JournalTransaction" ADD CONSTRAINT "JournalTransaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTransaction" ADD CONSTRAINT "JournalTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_journalTransactionId_fkey" FOREIGN KEY ("journalTransactionId") REFERENCES "JournalTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
