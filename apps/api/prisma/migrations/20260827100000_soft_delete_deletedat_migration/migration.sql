-- Soft-delete unification: replace `isActive Boolean @default(true)` with
-- `deletedAt DateTime?` across 23 models, mirroring the RAKHAL-397
-- (`20260826140000_animal_state_separation`) precedent's isActive->deletedAt
-- conversion style. Hand-authored (migrate dev/diff refuse non-interactively
-- here, same precedent as RAKHAL-364/365/366/367/397). `deletedAt` is
-- backfilled from `updatedAt` (best available "when it was archived"
-- timestamp) for every row that was already `isActive = false`.
--
-- Explicitly excluded (confirmed different semantics, not soft-delete):
-- `ReportSchedule.isActive` (cron pause/resume toggle) and
-- `PlatformAdmin.isActive` (login-suspension flag) — both untouched.
--
-- Dev-DB audit of isActive=false rows before writing this (2026-08-27):
--   FixedAsset 0, Breed 0, Shed 1, FeedGroup 0, MilkBuyer 1,
--   ReproProtocol 0, FeedIngredient 32, FeedConcentration 48, Supplier 0,
--   ServiceProvider 2, HealthCase 9, HealthPlan 3, HealthTask 0,
--   DiseaseCatalog 0, Equipment 28, Forage/FeedItem 45, MilkTank 35,
--   Medicine 28, Unit 0, SemenTank 0, SemenBatch 1, FeedStock 15,
--   FinancialAccount 0.

-- FixedAsset: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "FixedAsset" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FixedAsset" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "FixedAsset" DROP COLUMN "isActive";

-- Breed: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Breed" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Breed" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Breed" DROP COLUMN "isActive";

-- Shed: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Shed" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Shed" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Shed" DROP COLUMN "isActive";

-- FeedGroup: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "FeedGroup" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FeedGroup" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "FeedGroup" DROP COLUMN "isActive";

-- MilkBuyer: replace isActive (Boolean) with deletedAt (DateTime?).
-- Had a farmId+isActive composite index -> swap to farmId+deletedAt.
ALTER TABLE "MilkBuyer" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "MilkBuyer" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "MilkBuyer" DROP COLUMN "isActive";
DROP INDEX IF EXISTS "MilkBuyer_farmId_isActive_idx";
CREATE INDEX "MilkBuyer_farmId_deletedAt_idx" ON "MilkBuyer"("farmId", "deletedAt");

-- ReproProtocol: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "ReproProtocol" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "ReproProtocol" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "ReproProtocol" DROP COLUMN "isActive";

-- FeedIngredient: replace isActive (Boolean) with deletedAt (DateTime?).
-- Had a plain isActive index (no farmId column on this global-catalogue
-- model) -> swap to a plain deletedAt index.
ALTER TABLE "FeedIngredient" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FeedIngredient" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "FeedIngredient" DROP COLUMN "isActive";
DROP INDEX IF EXISTS "FeedIngredient_isActive_idx";
CREATE INDEX "FeedIngredient_deletedAt_idx" ON "FeedIngredient"("deletedAt");

-- FeedConcentration: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "FeedConcentration" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FeedConcentration" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "FeedConcentration" DROP COLUMN "isActive";

-- Supplier: replace isActive (Boolean) with deletedAt (DateTime?).
-- Had a farmId+isActive composite index -> swap to farmId+deletedAt.
ALTER TABLE "Supplier" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Supplier" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Supplier" DROP COLUMN "isActive";
DROP INDEX IF EXISTS "Supplier_farmId_isActive_idx";
CREATE INDEX "Supplier_farmId_deletedAt_idx" ON "Supplier"("farmId", "deletedAt");

-- ServiceProvider: replace isActive (Boolean) with deletedAt (DateTime?).
-- Had a farmId+isActive composite index -> swap to farmId+deletedAt.
ALTER TABLE "ServiceProvider" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "ServiceProvider" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "ServiceProvider" DROP COLUMN "isActive";
DROP INDEX IF EXISTS "ServiceProvider_farmId_isActive_idx";
CREATE INDEX "ServiceProvider_farmId_deletedAt_idx" ON "ServiceProvider"("farmId", "deletedAt");

-- HealthCase: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "HealthCase" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "HealthCase" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "HealthCase" DROP COLUMN "isActive";

-- HealthPlan: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "HealthPlan" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "HealthPlan" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "HealthPlan" DROP COLUMN "isActive";

-- HealthTask: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "HealthTask" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "HealthTask" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "HealthTask" DROP COLUMN "isActive";

-- DiseaseCatalog: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "DiseaseCatalog" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "DiseaseCatalog" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "DiseaseCatalog" DROP COLUMN "isActive";

-- Equipment: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Equipment" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Equipment" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Equipment" DROP COLUMN "isActive";

-- FeedItem (table "Forage", @@map): replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Forage" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Forage" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Forage" DROP COLUMN "isActive";

-- MilkTank: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "MilkTank" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "MilkTank" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "MilkTank" DROP COLUMN "isActive";

-- Medicine: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Medicine" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Medicine" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Medicine" DROP COLUMN "isActive";

-- Unit: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "Unit" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "Unit" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "Unit" DROP COLUMN "isActive";

-- SemenTank: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "SemenTank" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "SemenTank" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "SemenTank" DROP COLUMN "isActive";

-- SemenBatch: replace isActive (Boolean) with deletedAt (DateTime?).
ALTER TABLE "SemenBatch" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "SemenBatch" SET "deletedAt" = "updatedAt" WHERE "isActive" = false;
ALTER TABLE "SemenBatch" DROP COLUMN "isActive";

-- FeedStock: replace isActive (Boolean) with deletedAt (DateTime?).
-- FeedStock has no updatedAt column (create-only model) -> backfill from createdAt instead.
ALTER TABLE "FeedStock" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FeedStock" SET "deletedAt" = "createdAt" WHERE "isActive" = false;
ALTER TABLE "FeedStock" DROP COLUMN "isActive";

-- FinancialAccount: consolidate isActive + archivedAt into single deletedAt.
ALTER TABLE "FinancialAccount" ADD COLUMN "deletedAt" TIMESTAMP(3);
UPDATE "FinancialAccount" SET "deletedAt" = COALESCE("archivedAt", "updatedAt") WHERE "isActive" = false;
ALTER TABLE "FinancialAccount" DROP COLUMN "isActive";
ALTER TABLE "FinancialAccount" DROP COLUMN "archivedAt";
