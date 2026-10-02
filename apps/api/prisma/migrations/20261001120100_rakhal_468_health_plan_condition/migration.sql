-- RAKHAL-468 (MILESTONE 29): the structured condition a protocol is for, so Report Sickness can suggest matching
-- protocols first. Nullable and additive — existing protocols stay "general".
ALTER TABLE "HealthPlan" ADD COLUMN "condition" "HealthCondition";

CREATE INDEX "HealthPlan_farmId_condition_idx" ON "HealthPlan"("farmId", "condition");
