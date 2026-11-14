-- RAKHAL-367 — Document void status + `5900 Other Expense` (MILESTONE 22,
-- `docs/BUSINESS_IA_PRD.md` §9.4). Hand-authored (`prisma migrate dev`/
-- `diff` both refuse non-interactively in this environment, same precedent
-- as every prior migration on this board). Closes RD-060.

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- AlterTable — Purchase gains status, defaulted so every existing row
-- backfills to CONFIRMED with no data migration needed.
ALTER TABLE "Purchase" ADD COLUMN "status" "PurchaseStatus" NOT NULL DEFAULT 'CONFIRMED';

-- AlterTable — Expense gains voidedAt (nullable timestamp, same discipline
-- as MilkDispatch.cancelledAt from RAKHAL-366).
ALTER TABLE "Expense" ADD COLUMN "voidedAt" TIMESTAMP(3);

-- AlterEnum — ExpenseCategory gains OTHER, additive only.
ALTER TYPE "ExpenseCategory" ADD VALUE 'OTHER';
