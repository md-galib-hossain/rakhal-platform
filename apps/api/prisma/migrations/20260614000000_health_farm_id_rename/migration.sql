-- Rename tenant column from organizationId to farmId for the Health module.
-- This preserves existing health data and aligns the API/schema vocabulary
-- with Rakhal's existing Farm tenant model.

ALTER TABLE "HealthCase" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "HealthPlan" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "HealthTask" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "TreatmentLog" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "HealthUpdate" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "MortalityRecord" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "SafetyWithdrawal" RENAME COLUMN "organizationId" TO "farmId";
ALTER TABLE "DiseaseCatalog" RENAME COLUMN "organizationId" TO "farmId";

ALTER TABLE "HealthCase" RENAME CONSTRAINT "HealthCase_organizationId_fkey" TO "HealthCase_farmId_fkey";
ALTER TABLE "HealthPlan" RENAME CONSTRAINT "HealthPlan_organizationId_fkey" TO "HealthPlan_farmId_fkey";
ALTER TABLE "HealthTask" RENAME CONSTRAINT "HealthTask_organizationId_fkey" TO "HealthTask_farmId_fkey";
ALTER TABLE "TreatmentLog" RENAME CONSTRAINT "TreatmentLog_organizationId_fkey" TO "TreatmentLog_farmId_fkey";
ALTER TABLE "HealthUpdate" RENAME CONSTRAINT "HealthUpdate_organizationId_fkey" TO "HealthUpdate_farmId_fkey";
ALTER TABLE "MortalityRecord" RENAME CONSTRAINT "MortalityRecord_organizationId_fkey" TO "MortalityRecord_farmId_fkey";
ALTER TABLE "SafetyWithdrawal" RENAME CONSTRAINT "SafetyWithdrawal_organizationId_fkey" TO "SafetyWithdrawal_farmId_fkey";
ALTER TABLE "DiseaseCatalog" RENAME CONSTRAINT "DiseaseCatalog_organizationId_fkey" TO "DiseaseCatalog_farmId_fkey";

ALTER INDEX "HealthCase_organizationId_cattleId_idx" RENAME TO "HealthCase_farmId_cattleId_idx";
ALTER INDEX "HealthCase_organizationId_status_idx" RENAME TO "HealthCase_farmId_status_idx";
ALTER INDEX "HealthCase_organizationId_diagnosis_idx" RENAME TO "HealthCase_farmId_diagnosis_idx";
ALTER INDEX "HealthCase_organizationId_priority_idx" RENAME TO "HealthCase_farmId_priority_idx";
ALTER INDEX "HealthCase_organizationId_startDate_idx" RENAME TO "HealthCase_farmId_startDate_idx";
ALTER INDEX "HealthCase_organizationId_caseCode_key" RENAME TO "HealthCase_farmId_caseCode_key";

ALTER INDEX "HealthPlan_organizationId_category_idx" RENAME TO "HealthPlan_farmId_category_idx";
ALTER INDEX "HealthPlan_organizationId_name_idx" RENAME TO "HealthPlan_farmId_name_idx";
ALTER INDEX "HealthPlan_organizationId_name_key" RENAME TO "HealthPlan_farmId_name_key";

ALTER INDEX "HealthTask_organizationId_dueDateTime_idx" RENAME TO "HealthTask_farmId_dueDateTime_idx";
ALTER INDEX "HealthTask_organizationId_status_idx" RENAME TO "HealthTask_farmId_status_idx";
ALTER INDEX "HealthTask_organizationId_cattleId_idx" RENAME TO "HealthTask_farmId_cattleId_idx";
ALTER INDEX "HealthTask_organizationId_healthCaseId_idx" RENAME TO "HealthTask_farmId_healthCaseId_idx";
ALTER INDEX "HealthTask_organizationId_taskCode_key" RENAME TO "HealthTask_farmId_taskCode_key";

ALTER INDEX "TreatmentLog_organizationId_cattleId_idx" RENAME TO "TreatmentLog_farmId_cattleId_idx";
ALTER INDEX "TreatmentLog_organizationId_healthCaseId_idx" RENAME TO "TreatmentLog_farmId_healthCaseId_idx";
ALTER INDEX "TreatmentLog_organizationId_administeredAt_idx" RENAME TO "TreatmentLog_farmId_administeredAt_idx";

ALTER INDEX "HealthUpdate_organizationId_healthCaseId_idx" RENAME TO "HealthUpdate_farmId_healthCaseId_idx";
ALTER INDEX "HealthUpdate_organizationId_cattleId_idx" RENAME TO "HealthUpdate_farmId_cattleId_idx";
ALTER INDEX "HealthUpdate_organizationId_recordedAt_idx" RENAME TO "HealthUpdate_farmId_recordedAt_idx";

ALTER INDEX "MortalityRecord_organizationId_cattleId_idx" RENAME TO "MortalityRecord_farmId_cattleId_idx";
ALTER INDEX "MortalityRecord_organizationId_healthCaseId_idx" RENAME TO "MortalityRecord_farmId_healthCaseId_idx";
ALTER INDEX "MortalityRecord_organizationId_deathDate_idx" RENAME TO "MortalityRecord_farmId_deathDate_idx";

ALTER INDEX "SafetyWithdrawal_organizationId_cattleId_idx" RENAME TO "SafetyWithdrawal_farmId_cattleId_idx";
ALTER INDEX "SafetyWithdrawal_organizationId_status_idx" RENAME TO "SafetyWithdrawal_farmId_status_idx";
ALTER INDEX "SafetyWithdrawal_organizationId_healthCaseId_idx" RENAME TO "SafetyWithdrawal_farmId_healthCaseId_idx";

ALTER INDEX "DiseaseCatalog_organizationId_idx" RENAME TO "DiseaseCatalog_farmId_idx";
