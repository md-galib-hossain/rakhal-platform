-- RAKHAL-277: MilkLogEntry.disposition (business-meaning milk classification).
--
-- New enum: MilkDisposition = SALEABLE|WITHHELD|COLOSTRUM|CALF_FEED|DISCARDED|
-- HOUSEHOLD_USE. Distinct from the existing `tankType` (physical SELLABLE/
-- WITHHOLDING routing) — `disposition` is *why*, `tankType` is *where*.
--
-- New column: MilkLogEntry.disposition, ends up NOT NULL, but deliberately gets
-- NO DB DEFAULT for ongoing writes (v2 correction — v1's draft briefly had
-- `default SALEABLE`, flagged as unsafe: a failed eligibility lookup at insert
-- time could silently fall through to that default and ship milk that should
-- have been WITHHELD/COLOSTRUM). Going forward, MilkService.saveLog() computes
-- `disposition` itself before every insert, from a live withholding check
-- (HealthService.activeMilkWithholdingCattleIds) plus a colostrum-window check
-- against the cow's active Lactation, in the same transaction as the
-- eligibility check — never from a schema default.
--
-- Historical rows predate this disposition concept entirely and have no live
-- eligibility context left to recompute against (the withholding/lactation
-- state at the moment each historical entry was logged is not reconstructable
-- after the fact). The three statements below perform a ONE-TIME HISTORICAL
-- BACKFILL to 'SALEABLE' for those existing rows ONLY — this is a migration-time
-- data fix, not a schema default and not ongoing runtime behavior. Every row
-- inserted after this migration gets its disposition computed by the
-- application, never this backfill value.

CREATE TYPE "MilkDisposition" AS ENUM ('SALEABLE', 'WITHHELD', 'COLOSTRUM', 'CALF_FEED', 'DISCARDED', 'HOUSEHOLD_USE');

-- Step 1: add nullable (a NOT NULL column can't be added to a populated table
-- without either a default or a backfill; we deliberately want neither for the
-- column's steady-state, only for this one-time historical migration).
ALTER TABLE "MilkLogEntry" ADD COLUMN "disposition" "MilkDisposition";

-- Step 2: one-time historical backfill — existing rows only, documented above.
UPDATE "MilkLogEntry" SET "disposition" = 'SALEABLE' WHERE "disposition" IS NULL;

-- Step 3: lock the column down to NOT NULL with still no default, so every
-- future insert must supply a computed value or fail loudly.
ALTER TABLE "MilkLogEntry" ALTER COLUMN "disposition" SET NOT NULL;
