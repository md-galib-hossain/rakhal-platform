-- RAKHAL-466 (MILESTONE 29): HealthPlan.successRate and HealthPlan.currentlyActiveAnimalCount were never written or
-- read by any code (grep of src/ on 2026-10-01). Protocol results are now computed live from cases and enrollments
-- (HealthPlanStatsService), so the stored copies are dropped rather than left to drift.
ALTER TABLE "HealthPlan" DROP COLUMN "successRate",
DROP COLUMN "currentlyActiveAnimalCount";
