-- RAKHAL-302 follow-up: add SemenStrawMovement.notes (free-text reason for a
-- REVERSAL, e.g. "breeding event's semenBatchId edited"). Split into its own
-- migration rather than editing the just-applied
-- 20260809120000_rakhal_302_semen_straw_ledger, since that migration's
-- checksum is already recorded against this dev DB.

-- AlterTable
ALTER TABLE "SemenStrawMovement" ADD COLUMN "notes" TEXT;
