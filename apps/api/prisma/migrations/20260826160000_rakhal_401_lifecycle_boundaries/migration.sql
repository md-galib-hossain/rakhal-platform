-- RAKHAL-401: farm-configurable day boundaries for the lifecycle sub-stage
-- layer (`deriveLifecycleSubStage`/`buildLifecycleSubStageWhere`). Purely
-- additive — new NOT NULL DEFAULT columns on the existing FarmModuleSettings
-- row, mirrors RAKHAL-272's reproOverduePregnancyCheckDays-style additions.
-- Defaults reproduce the previously-hardcoded LIFECYCLE_WEANING_DAYS(60) /
-- LIFECYCLE_GROWING_START_DAYS(180) / LIFECYCLE_BREEDING_AGE_DAYS(390)
-- constants exactly.

ALTER TABLE "FarmModuleSettings" ADD COLUMN "cattleLifecycleWeaningDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "cattleLifecycleGrowingStartDays" INTEGER NOT NULL DEFAULT 180;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "cattleLifecycleBreedingAgeDays" INTEGER NOT NULL DEFAULT 390;
