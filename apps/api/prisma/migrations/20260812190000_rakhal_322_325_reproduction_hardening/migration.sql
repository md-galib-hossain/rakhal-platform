-- RAKHAL-323/325: idempotency-key bookkeeping table + pregnancy correction
-- workflow. Purely additive: one new enum value, three nullable columns on
-- Pregnancy, one new standalone table. No backfill needed.

-- AlterEnum
ALTER TYPE "PregnancyStatus" ADD VALUE 'CANCELLED_CORRECTION';

-- AlterTable
ALTER TABLE "Pregnancy" ADD COLUMN "correctionReason" TEXT,
ADD COLUMN "correctedBy" TEXT,
ADD COLUMN "correctedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_farmId_key_endpoint_key" ON "IdempotencyKey"("farmId", "key", "endpoint");

-- CreateIndex
CREATE INDEX "IdempotencyKey_farmId_endpoint_idx" ON "IdempotencyKey"("farmId", "endpoint");
