-- RAKHAL-273: farm-configurable day thresholds for the derived (not stored)
-- LactationStage/PregnancyStage. Purely additive — new nullable-safe
-- NOT NULL DEFAULT columns on the existing FarmModuleSettings row, mirrors
-- RAKHAL-271's reproHeatWindowDays/reproCloseUpWindowDays addition.

ALTER TABLE "FarmModuleSettings" ADD COLUMN "lactationFreshDays" INTEGER NOT NULL DEFAULT 21;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "lactationEarlyDays" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "lactationMidDays" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "pregnancyEarlyDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "pregnancyMidDays" INTEGER NOT NULL DEFAULT 180;
