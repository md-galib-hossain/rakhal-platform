-- CreateEnum
CREATE TYPE "ReconciliationType" AS ENUM ('PAID_NOT_SETTLED', 'STATUS_MISMATCH', 'AMOUNT_MISMATCH', 'DUPLICATE', 'SETTLED_NO_INVOICE');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "ReconciliationException" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceId" TEXT,
    "farmId" TEXT,
    "providerPaymentId" TEXT,
    "type" "ReconciliationType" NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAmount" DECIMAL(12,2),
    "actualAmount" DECIMAL(12,2),
    "detail" TEXT,
    "resolvedByAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationException_status_createdAt_idx" ON "ReconciliationException"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationException_type_idx" ON "ReconciliationException"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationException_paymentId_type_key" ON "ReconciliationException"("paymentId", "type");
