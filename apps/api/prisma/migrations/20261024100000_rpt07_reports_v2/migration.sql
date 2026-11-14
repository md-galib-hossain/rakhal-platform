-- RPT-07 (Reports v2, docs/EPIC_REPORTS.md): Report/ReportSnapshot/ReportTemplateVersion,
-- drop of the orphaned RAKHAL-103 ReportJob/ReportSchedule tables (owner-approved, decision 3),
-- Cattle.enteredHerdAt, SubscriptionPlan.reportRetentionDays, report AuditAction values.
-- Hand-authored, applied with `prisma migrate deploy`. DOWN SQL: ./down.sql (documentation, never auto-run).

-- 1. Drop orphans (tables first, then their enums; nothing else uses them).
DROP TABLE "ReportJob";
DROP TABLE "ReportSchedule";
DROP TYPE "ReportFormat";
DROP TYPE "ReportJobStatus";
DROP TYPE "ReportScheduleFrequency";

-- 2. Enums.
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'ON_DEMAND');
CREATE TYPE "ReportOrigin" AS ENUM ('SCHEDULED', 'ON_DEMAND');
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportErrorCategory" AS ENUM ('STORAGE_UNAVAILABLE', 'DB_TIMEOUT', 'QUEUE_UNAVAILABLE', 'INVALID_CONFIG', 'PLAN_LIMIT', 'PERMISSION_DENIED', 'RENDER_FAILED');

-- AlterEnum (values are not used in this migration, so same-transaction is safe).
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_DOWNLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_RETRIED';
ALTER TYPE "AuditAction" ADD VALUE 'REPORT_PREVIEWED';

-- 3. Tables.
CREATE TABLE "ReportTemplateVersion" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "origin" "ReportOrigin" NOT NULL,
    "type" "ReportType" NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodStartDate" TEXT NOT NULL,
    "periodEndDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "selectedMetricIds" JSONB NOT NULL,
    "includesFinance" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCategory" "ReportErrorCategory",
    "errorMessage" TEXT,
    "requestedBy" TEXT,
    "idempotencyKey" TEXT,
    "scheduledKey" TEXT,
    "artifactKey" TEXT,
    "artifactBytes" INTEGER,
    "artifactContentType" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "calcVersion" INTEGER NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "includesFinance" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes. The two UNIQUEs treat NULLs as distinct (Postgres default), i.e. they behave as
-- partial "WHERE ... IS NOT NULL" uniques without raw SQL that Prisma would report as drift.
CREATE UNIQUE INDEX "ReportTemplateVersion_type_version_key" ON "ReportTemplateVersion"("type", "version");
CREATE INDEX "ReportTemplateVersion_type_effectiveFrom_idx" ON "ReportTemplateVersion"("type", "effectiveFrom");
CREATE UNIQUE INDEX "Report_scheduledKey_key" ON "Report"("scheduledKey");
CREATE UNIQUE INDEX "Report_farmId_requestedBy_idempotencyKey_key" ON "Report"("farmId", "requestedBy", "idempotencyKey");
CREATE INDEX "Report_farmId_createdAt_idx" ON "Report"("farmId", "createdAt" DESC);
CREATE INDEX "Report_farmId_status_idx" ON "Report"("farmId", "status");
CREATE INDEX "Report_farmId_type_periodStart_idx" ON "Report"("farmId", "type", "periodStart");
CREATE INDEX "Report_status_expiresAt_idx" ON "Report"("status", "expiresAt");
CREATE UNIQUE INDEX "ReportSnapshot_reportId_key" ON "ReportSnapshot"("reportId");

-- 5. Foreign keys.
ALTER TABLE "Report" ADD CONSTRAINT "Report_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ReportTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Immutability: a snapshot is written once and never updated (DELETE stays allowed for the
-- cascade from Report / retention cleanup).
CREATE FUNCTION "report_snapshot_block_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ReportSnapshot is immutable (UPDATE not allowed)' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ReportSnapshot_block_update" BEFORE UPDATE ON "ReportSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "report_snapshot_block_update"();

-- 7. Columns on existing tables.
ALTER TABLE "Cattle" ADD COLUMN "enteredHerdAt" DATE;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "reportRetentionDays" INTEGER NOT NULL DEFAULT 365;

-- Backfill (decision 1): farm-local civil date of createdAt. Existing plan rows get the 365 default.
UPDATE "Cattle" c
   SET "enteredHerdAt" = ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE f."timezone")::date
  FROM "Farm" f
 WHERE f."id" = c."farmId";

-- 8. Seed template v1 per type. In the migration (not prisma/seed.ts) so scheduling works on every
-- environment right after deploy, with no dependency on `pnpm seed`; fixed ids + ON CONFLICT DO
-- NOTHING keep it idempotent and never overwrite a founder-published version.
INSERT INTO "ReportTemplateVersion" ("id", "type", "version", "definition", "effectiveFrom", "createdBy") VALUES
  ('rtv_weekly_v1', 'WEEKLY', 1, '{"type":"WEEKLY","version":1,"sections":[{"id":"milk","domain":"milk","metricIds":["milk.total_yield","milk.avg_daily_yield","milk.cows_with_data","milk.daily_yield","milk.top_cow_avg_yield","milk.bottom_cow_avg_yield","milk.sudden_drop_cows"],"titleKey":"reports.section.milk"},{"id":"health","domain":"health","metricIds":["health.cases_opened","health.cows_with_cases_opened","health.treatments_given","health.cases_closed","health.cases_recovered","health.cases_mortality","health.cases_open_at_period_end","health.tasks_overdue","health.cases_repeated","health.withdrawals_active","health.treatment_cost"],"titleKey":"reports.section.health"},{"id":"reproduction","domain":"reproduction","metricIds":["reproduction.services_total","reproduction.outcomes_confirmed","reproduction.outcomes_pending","reproduction.outcomes_failed","reproduction.conception_rate","reproduction.pregnancy_checks_overdue","reproduction.calvings","reproduction.expected_calvings_30d"],"titleKey":"reports.section.reproduction"},{"id":"finance","domain":"finance","metricIds":["finance.cash_received","finance.cash_paid","finance.net_cash_flow","finance.opening_cash_balance","finance.closing_cash_balance","finance.expenses_total"],"titleKey":"reports.section.finance"},{"id":"feed","domain":"feed","metricIds":["feed.recorded_actual_kg","feed.refusal_kg","feed.offered_minus_refusal_kg","feed.distribution_cost","feed.cost_per_cow_day","feed.low_stock_items"],"titleKey":"reports.section.feed"}],"thresholds":{"suddenDropPct":30,"repeatedCaseWindowDays":60,"finalizationMaxWaitHours":6}}'::jsonb, TIMESTAMP '2026-10-24 00:00:00', NULL),
  ('rtv_monthly_v1', 'MONTHLY', 1, '{"type":"MONTHLY","version":1,"sections":[{"id":"milk","domain":"milk","metricIds":["milk.total_yield","milk.avg_daily_yield","milk.cows_with_data","milk.daily_yield","milk.top_cow_avg_yield","milk.bottom_cow_avg_yield","milk.sudden_drop_cows"],"titleKey":"reports.section.milk"},{"id":"health","domain":"health","metricIds":["health.cases_opened","health.cows_with_cases_opened","health.treatments_given","health.cases_closed","health.cases_recovered","health.cases_mortality","health.cases_open_at_period_end","health.tasks_overdue","health.cases_repeated","health.withdrawals_active","health.treatment_cost"],"titleKey":"reports.section.health"},{"id":"reproduction","domain":"reproduction","metricIds":["reproduction.services_total","reproduction.outcomes_confirmed","reproduction.outcomes_pending","reproduction.outcomes_failed","reproduction.conception_rate","reproduction.pregnancy_checks_overdue","reproduction.calvings","reproduction.expected_calvings_30d"],"titleKey":"reports.section.reproduction"},{"id":"finance","domain":"finance","metricIds":["finance.cash_received","finance.cash_paid","finance.net_cash_flow","finance.opening_cash_balance","finance.closing_cash_balance","finance.expenses_total"],"titleKey":"reports.section.finance"},{"id":"feed","domain":"feed","metricIds":["feed.recorded_actual_kg","feed.refusal_kg","feed.offered_minus_refusal_kg","feed.distribution_cost","feed.cost_per_cow_day","feed.low_stock_items"],"titleKey":"reports.section.feed"}],"thresholds":{"suddenDropPct":30,"repeatedCaseWindowDays":60,"finalizationMaxWaitHours":6}}'::jsonb, TIMESTAMP '2026-10-24 00:00:00', NULL),
  ('rtv_on_demand_v1', 'ON_DEMAND', 1, '{"type":"ON_DEMAND","version":1,"sections":[{"id":"milk","domain":"milk","metricIds":["milk.total_yield","milk.avg_daily_yield","milk.cows_with_data","milk.daily_yield","milk.top_cow_avg_yield","milk.bottom_cow_avg_yield","milk.sudden_drop_cows"],"titleKey":"reports.section.milk"},{"id":"health","domain":"health","metricIds":["health.cases_opened","health.cows_with_cases_opened","health.treatments_given","health.cases_closed","health.cases_recovered","health.cases_mortality","health.cases_open_at_period_end","health.tasks_overdue","health.cases_repeated","health.withdrawals_active","health.treatment_cost"],"titleKey":"reports.section.health"},{"id":"reproduction","domain":"reproduction","metricIds":["reproduction.services_total","reproduction.outcomes_confirmed","reproduction.outcomes_pending","reproduction.outcomes_failed","reproduction.conception_rate","reproduction.pregnancy_checks_overdue","reproduction.calvings","reproduction.expected_calvings_30d"],"titleKey":"reports.section.reproduction"},{"id":"finance","domain":"finance","metricIds":["finance.cash_received","finance.cash_paid","finance.net_cash_flow","finance.opening_cash_balance","finance.closing_cash_balance","finance.expenses_total"],"titleKey":"reports.section.finance"},{"id":"feed","domain":"feed","metricIds":["feed.recorded_actual_kg","feed.refusal_kg","feed.offered_minus_refusal_kg","feed.distribution_cost","feed.cost_per_cow_day","feed.low_stock_items"],"titleKey":"reports.section.feed"}],"thresholds":{"suddenDropPct":30,"repeatedCaseWindowDays":60,"finalizationMaxWaitHours":6}}'::jsonb, TIMESTAMP '2026-10-24 00:00:00', NULL)
ON CONFLICT DO NOTHING;
