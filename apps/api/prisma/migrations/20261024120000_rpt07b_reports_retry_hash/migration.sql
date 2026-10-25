-- RPT-07b: manual retry counter, idempotency request hash, GENERATION_FAILED error category,
-- and fix seeded template effectiveFrom (v1 literal was in the near future => TEMPLATE_UNAVAILABLE).
ALTER TABLE "Report" ADD COLUMN "manualRetries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Report" ADD COLUMN "requestHash" TEXT;

-- Not used in this migration (Postgres forbids using a new enum value in the same transaction).
ALTER TYPE "ReportErrorCategory" ADD VALUE 'GENERATION_FAILED';

-- Seeded rows only; never touch a founder-published version.
UPDATE "ReportTemplateVersion"
SET "effectiveFrom" = TIMESTAMP '2020-01-01 00:00:00'
WHERE "id" IN ('rtv_weekly_v1', 'rtv_monthly_v1', 'rtv_on_demand_v1')
  AND "createdBy" IS NULL;
