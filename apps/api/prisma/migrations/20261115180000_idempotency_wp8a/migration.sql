-- WP8a (mobile offline sync, ADR-006). Additive and nullable: no backfill, existing rows and callers unaffected.
-- IdempotencyKey: request hash (same key + different body is a reused key) and the sending user; createdAt index for the expiry sweep.
ALTER TABLE "IdempotencyKey" ADD COLUMN "requestHash" TEXT,
ADD COLUMN "userId" TEXT;

CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

-- MilkLogEntry: who last saved the entry, so a sync conflict can name them.
ALTER TABLE "MilkLogEntry" ADD COLUMN "updatedBy" TEXT;
