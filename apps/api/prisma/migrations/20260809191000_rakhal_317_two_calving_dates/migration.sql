-- RAKHAL-317: Pregnancy gains a system-calculated calving date, kept
-- separate from the farmer-facing `expectedCalvingDate`, plus a source flag.
-- Backfill is a pure function of data already on each row (conceptionDate +
-- the same 280-day constant the service already uses as its fallback), not a
-- guess.

-- CreateEnum
CREATE TYPE "ExpectedCalvingDateSource" AS ENUM ('SYSTEM', 'MANUAL');

-- AlterTable
ALTER TABLE "Pregnancy"
  ADD COLUMN "calculatedCalvingDate" TIMESTAMP(3),
  ADD COLUMN "expectedCalvingDateSource" "ExpectedCalvingDateSource" NOT NULL DEFAULT 'SYSTEM';

-- Backfill: every existing row's system estimate is conceptionDate + 280
-- days, the same fallback `createPregnancyDiagnosis` already applies today.
UPDATE "Pregnancy"
SET "calculatedCalvingDate" = "conceptionDate" + INTERVAL '280 days';

-- Backfill: a row whose expectedCalvingDate differs from the just-computed
-- system estimate (same-day comparison, ignoring time-of-day) was a farmer
-- override — mark it MANUAL. Everything else (equal, or expectedCalvingDate
-- was null) stays the column default SYSTEM.
UPDATE "Pregnancy"
SET "expectedCalvingDateSource" = 'MANUAL'
WHERE "expectedCalvingDate" IS NOT NULL
  AND "expectedCalvingDate"::date <> "calculatedCalvingDate"::date;
