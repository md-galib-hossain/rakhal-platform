-- RAKHAL-272: farm-configurable thresholds for the extended
-- `deriveReproductionAlerts` set (OVERDUE_PREGNANCY_CHECK / REPEAT_BREEDER /
-- LONG_DAYS_OPEN / CALVING_OVERDUE). Purely additive — new NOT NULL DEFAULT
-- columns on the existing FarmModuleSettings row, mirrors RAKHAL-271/273's
-- reproHeatWindowDays/lactationFreshDays-style additions.

ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproOverduePregnancyCheckDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproRepeatBreederThreshold" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproLongDaysOpenDays" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "FarmModuleSettings" ADD COLUMN "reproCalvingOverdueDays" INTEGER NOT NULL DEFAULT 7;
