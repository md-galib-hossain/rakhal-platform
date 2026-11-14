-- RAKHAL-285: dynamic, pregnancy-driven dry-off projection.
-- `Lactation.recommendedDryOffAt` (system-computed, `expectedCalvingDate -
-- reproDryPeriodTargetDays`, recomputed on pregnancy confirmation/
-- re-diagnosis, cleared on abortion) and `Lactation.plannedDryOffAt`
-- (farmer-writable, independent of the recommended value) — both nullable,
-- no default (additive, hand-authored per this repo's established
-- shared-dev-DB migration precedent, mirrors RAKHAL-278's
-- `20260805190000_rakhal_278_milk_colostrum_window_days`).
--
-- Also adds `FarmModuleSettings.minDimFor305DayYield` (NOT NULL DEFAULT 30,
-- matching the schema's `@default(30)`) — the DIM gate below which the
-- optional `standardized305DayYield` secondary comparison metric stays null.

ALTER TABLE "Lactation" ADD COLUMN "recommendedDryOffAt" TIMESTAMP(3);
ALTER TABLE "Lactation" ADD COLUMN "plannedDryOffAt" TIMESTAMP(3);

ALTER TABLE "FarmModuleSettings" ADD COLUMN "minDimFor305DayYield" INTEGER NOT NULL DEFAULT 30;
