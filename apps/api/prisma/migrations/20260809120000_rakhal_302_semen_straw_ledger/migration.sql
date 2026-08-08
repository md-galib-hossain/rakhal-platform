-- RAKHAL-302: SemenService.restoreStraw + straw stock ledger.
-- New SemenStrawMovementReason enum + SemenStrawMovement table, mirroring
-- EquipmentStockMovement/MedicineStockMovement's append-only shape.
-- Hand-authored (`prisma migrate dev`/`--create-only` both refuse
-- non-interactively on this environment, same precedent as RAKHAL-298/299).
--
-- Backfill decision: `decrementStraw` is not the only writer of
-- `SemenBatch.strawQuantity` — `createBatch`/`updateBatch` also accept a raw
-- `strawQuantity` from the DTO with no ledger entry, so a historical
-- per-BreedingEvent replay (one -1 AI_USE row per BreedingEvent.semenBatchId)
-- could NOT be trusted to reconstruct the true balanceAfter series for any
-- batch that was also edited directly. Reconciliation is genuinely ambiguous,
-- so per this ticket's own AC we take the documented fallback: one
-- OPENING_BALANCE row per existing SemenBatch, delta/balanceAfter = its
-- current strawQuantity, timestamped `now()` (the migration's apply time,
-- not a fabricated historical date — we only know the balance as of now).

-- CreateEnum
CREATE TYPE "SemenStrawMovementReason" AS ENUM ('AI_USE', 'REVERSAL', 'OPENING_BALANCE');

-- CreateTable
CREATE TABLE "SemenStrawMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reason" "SemenStrawMovementReason" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceEventId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemenStrawMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SemenStrawMovement_batchId_idx" ON "SemenStrawMovement"("batchId");

-- CreateIndex
CREATE INDEX "SemenStrawMovement_farmId_idx" ON "SemenStrawMovement"("farmId");

-- CreateIndex
CREATE INDEX "SemenStrawMovement_createdAt_idx" ON "SemenStrawMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "SemenStrawMovement" ADD CONSTRAINT "SemenStrawMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SemenBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one OPENING_BALANCE row per existing SemenBatch (see note above).
INSERT INTO "SemenStrawMovement" ("id", "batchId", "farmId", "reason", "delta", "balanceAfter", "createdAt")
SELECT gen_random_uuid()::text, "id", "farmId", 'OPENING_BALANCE', "strawQuantity", "strawQuantity", CURRENT_TIMESTAMP
FROM "SemenBatch";
