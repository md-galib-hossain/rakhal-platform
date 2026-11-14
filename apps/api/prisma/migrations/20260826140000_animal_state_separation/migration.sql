-- RAKHAL-397 (ADR-024): separate herd-membership status from record-level
-- soft delete. Hand-authored (migrate dev/diff refuse non-interactively here,
-- same precedent as RAKHAL-364/365/366/367). Excludes the pre-existing
-- unrelated SafetyWithdrawalStatus enum-drop drift (RD-054).
--
-- Dev-DB audit before writing this (2026-08-26): ACTIVE 1428 / SOLD 195 /
-- DEAD 6 / TRANSFERRED 5 / ARCHIVED 14 / CULLED 10, MISSING 0. Every
-- isActive=false row already has a non-ACTIVE status (no ACTIVE+isActive=false
-- rows) so the backfill below is unambiguous.

-- Step 1: rename DEAD -> DECEASED and the enum type itself.
ALTER TYPE "CattleStatus" RENAME VALUE 'DEAD' TO 'DECEASED';
ALTER TYPE "CattleStatus" RENAME TO "HerdStatus";

-- Step 2: rename the column, add the new soft-delete columns.
ALTER TABLE "Cattle" RENAME COLUMN "status" TO "herdStatus";
ALTER TABLE "Cattle" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Cattle" ADD COLUMN "deletedById" TEXT;

-- Step 3: backfill. ARCHIVED was always a record-deletion, never a herd exit
-- -> becomes ACTIVE + deletedAt stamped from updatedAt (best available
-- timestamp for when the archive happened). TRANSFERRED folds into SOLD
-- (CattleDisposition.type keeps the real TRANSFER reason where one exists).
UPDATE "Cattle" SET "deletedAt" = "updatedAt", "herdStatus" = 'ACTIVE' WHERE "herdStatus" = 'ARCHIVED';
UPDATE "Cattle" SET "herdStatus" = 'SOLD' WHERE "herdStatus" = 'TRANSFERRED';

-- Step 4: drop isActive (superseded by herdStatus/deletedAt) and the two
-- retired enum values. Postgres enum value drops require rebuilding the type.
ALTER TABLE "Cattle" DROP COLUMN "isActive";

ALTER TYPE "HerdStatus" RENAME TO "HerdStatus_old";
CREATE TYPE "HerdStatus" AS ENUM ('ACTIVE', 'SOLD', 'CULLED', 'DECEASED');
ALTER TABLE "Cattle" ALTER COLUMN "herdStatus" DROP DEFAULT;
ALTER TABLE "Cattle" ALTER COLUMN "herdStatus" TYPE "HerdStatus" USING ("herdStatus"::text::"HerdStatus");
ALTER TABLE "Cattle" ALTER COLUMN "herdStatus" SET DEFAULT 'ACTIVE';
DROP TYPE "HerdStatus_old";

-- Step 5: index changes (old @@index([status]) -> composite herdStatus/deletedAt).
DROP INDEX IF EXISTS "Cattle_status_idx";
CREATE INDEX "Cattle_farmId_herdStatus_idx" ON "Cattle"("farmId", "herdStatus");
CREATE INDEX "Cattle_farmId_deletedAt_idx" ON "Cattle"("farmId", "deletedAt");
