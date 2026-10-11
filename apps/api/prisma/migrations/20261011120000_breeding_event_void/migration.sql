-- Void a breeding / AI event (no ticket #, 2026-10-11). Additive only: one enum value + three nullable columns.
-- A voided event keeps its row (status = VOIDED) so the Finance reversal, the straw restore and the audit
-- trail keep a stable id to point at.
ALTER TYPE "BreedingStatus" ADD VALUE 'VOIDED';

ALTER TABLE "BreedingEvent"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT;
