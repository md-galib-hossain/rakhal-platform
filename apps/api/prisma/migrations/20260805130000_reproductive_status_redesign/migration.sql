-- RAKHAL-271: split the pure breeding-cycle status into a 5-value
-- `ReproductionState` (core, stored) + `ReproductionAlert[]` (derived, not
-- stored — computed at read time in `deriveReproductionAlerts`).
--
-- v2 correction (this migration replaces the v1 version, which was never
-- applied to any database): v1 CASE-mapped old values straight into new ones
-- (e.g. `DRY`/`LACTATING`/`HEIFER` -> `OPEN`), which a second review flagged
-- as unsafe — a cow that was `DRY` or `LACTATING` under the old enum is very
-- often still pregnant, so guessing `OPEN` fabricates false fertility data
-- that nothing would ever flag as wrong. v2 instead: drops the old
-- `ReproductiveStatus` type/column outright, adds the new
-- `ReproductionState` column **nullable, with no CASE-guess and no DB-level
-- default** (a DEFAULT on `ADD COLUMN` would silently backfill every existing
-- row with that value — the exact same fabrication bug in a different guise).
-- Existing `ReproductionProfile` rows land on `NULL` ("not assessed").
-- `prisma/backfill-reproduction-state.ts` (run once, separately, after this
-- migration) re-derives the real state per-cow from actual
-- `BreedingEvent`/`PregnancyDiagnosis`/`CalvingEvent`/`DryPeriod` history via
-- the same derivation function the app uses on every write
-- (`deriveReproductionState`), leaving genuinely ambiguous rows `NULL` rather
-- than guessing.
--
-- Also (RAKHAL-271 v2 correction, replacing the rejected
-- `Cattle.lactationStartDate` from RAKHAL-269's v1): adds `LactationStartReason`
-- + `Lactation.startReason`/`sourceCalvingEventId`. `startReason` defaults
-- existing rows to `CALVING` — safe, unlike the reproduction-state guess,
-- because every pre-existing `Lactation` row genuinely came from a calving
-- (there was no other way to create one before this ticket).

BEGIN;

-- ==== ReproductionProfile.reproductiveStatus: drop old, add new (no guess) ==

ALTER TABLE "ReproductionProfile" ALTER COLUMN "reproductiveStatus" DROP DEFAULT;
ALTER TABLE "ReproductionProfile" DROP COLUMN "reproductiveStatus";
DROP TYPE "ReproductiveStatus";

CREATE TYPE "ReproductionState" AS ENUM (
  'NOT_ELIGIBLE', 'POSTPARTUM_WAITING', 'OPEN', 'BRED_AWAITING_CONFIRMATION', 'PREGNANT'
);

-- Nullable, no default — every existing row becomes NULL ("not assessed"),
-- never a guessed value. `prisma/backfill-reproduction-state.ts` fills in
-- real, re-derived values afterwards.
ALTER TABLE "ReproductionProfile" ADD COLUMN "reproductiveStatus" "ReproductionState";

-- ==== FarmModuleSettings: farm-configurable alert windows (unchanged from v1) =
-- Still used — just by `deriveReproductionAlerts` (HEAT_DETECTED/CALVING_DUE)
-- instead of the core state derivation. `reproVwpDays` already existed and is
-- reused as-is by `deriveReproductionState`.

ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproHeatWindowDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproCloseUpWindowDays" INTEGER NOT NULL DEFAULT 21;

-- ==== Lactation.startReason / sourceCalvingEventId (RAKHAL-271 v2 correction,
-- replaces the rejected Cattle.lactationStartDate) ===========================

CREATE TYPE "LactationStartReason" AS ENUM ('CALVING', 'PURCHASE_IMPORT', 'MANUAL_CORRECTION');

-- Safe default for the backfill of existing rows: every pre-existing
-- Lactation row came from a calving (no other creation path existed yet).
ALTER TABLE "Lactation" ADD COLUMN "startReason" "LactationStartReason" NOT NULL DEFAULT 'CALVING';
ALTER TABLE "Lactation" ADD COLUMN "sourceCalvingEventId" TEXT;

COMMIT;
