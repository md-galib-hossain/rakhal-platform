-- DOWN (documentation only; NEVER auto-run, never against the shared dev DB without owner approval).
-- Reverts RPT-07. Orphan ReportJob/ReportSchedule data is NOT restorable (owner-approved drop);
-- recreate the tables from migrations 20260626055051 / 20260728192301 / 20260729053402 if ever needed.
-- AuditAction values cannot be removed in Postgres (ADD VALUE is irreversible without a type rebuild).
DROP TRIGGER "ReportSnapshot_block_update" ON "ReportSnapshot";
DROP FUNCTION "report_snapshot_block_update"();
DROP TABLE "ReportSnapshot";
DROP TABLE "Report";
DROP TABLE "ReportTemplateVersion";
DROP TYPE "ReportErrorCategory";
DROP TYPE "ReportStatus";
DROP TYPE "ReportOrigin";
DROP TYPE "ReportType";
ALTER TABLE "Cattle" DROP COLUMN "enteredHerdAt";
ALTER TABLE "SubscriptionPlan" DROP COLUMN "reportRetentionDays";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261024100000_rpt07_reports_v2';
