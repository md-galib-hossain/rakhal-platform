-- Semen Type (Conventional/Sex-Sorted) + Target Sex feature.

-- 1. Rename SemenType.SEXED -> SEX_SORTED (clearer industry term). `RENAME
-- VALUE` renames the enum label in place — no existing rows use SEXED yet
-- (seed data has none), but this is safe even if they did.
ALTER TYPE "SemenType" RENAME VALUE 'SEXED' TO 'SEX_SORTED';

-- 2. New TargetSex enum.
CREATE TYPE "TargetSex" AS ENUM ('FEMALE', 'MALE');

-- 3. SemenBatch gains semenType/targetSex as the source of truth (set once
-- when the batch is created/edited in Inventory).
ALTER TABLE "SemenBatch" ADD COLUMN "semenType" "SemenType";
ALTER TABLE "SemenBatch" ADD COLUMN "targetSex" "TargetSex";

-- 4. BreedingEvent gains targetSex alongside its existing semenType, so an
-- AI event's inherited/manual semen-type info is recorded historically.
ALTER TABLE "BreedingEvent" ADD COLUMN "targetSex" "TargetSex";
