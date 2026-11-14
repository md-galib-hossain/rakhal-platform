-- RAKHAL-419 — Treatment cost posts to Finance (MILESTONE 24). Hand-authored
-- (`prisma migrate dev`/`diff` both refuse non-interactively in this
-- environment — `20260827100000_soft_delete_deletedat_migration`'s checksum
-- drifted after being applied, demanding a full dev-DB reset — same
-- precedent every prior migration on this board follows).
--
-- Purely additive: one new enum value, one new nullable column. No existing
-- row changes. `HEALTH` posts against the already-seeded `5100 Medicine`
-- ledger account (RAKHAL-333) — no new `LedgerAccount` row needed for any
-- farm created after that seed; a one-off backfill script covers the small
-- number of farms that predate it (see `prisma/rakhal-419-backfill-5100.ts`).

-- AlterEnum — ExpenseCategory gains HEALTH, additive only.
ALTER TYPE "ExpenseCategory" ADD VALUE 'HEALTH';

-- AlterTable — TreatmentLog gains financeTransactionId (nullable, no
-- backfill: a treatment logged before this ticket never posted a cost, so
-- null is the correct historical value, not a gap to fill).
ALTER TABLE "TreatmentLog" ADD COLUMN "financeTransactionId" TEXT;
