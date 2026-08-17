-- RAKHAL-332: durable transactional outbox (repays RD-014).
-- Hand-authored: `prisma migrate dev` refuses non-interactively in this
-- environment (same precedent as every other hand-authored migration on this
-- board); the raw `migrate diff` output also included an unrelated
-- `SafetyWithdrawalStatus` enum-drop (RD-054, pre-existing, not part of this
-- ticket) which is excluded here, matching prior agents' own convention.

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_farmId_idx" ON "OutboxEvent"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_farmId_idempotencyKey_key" ON "OutboxEvent"("farmId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
