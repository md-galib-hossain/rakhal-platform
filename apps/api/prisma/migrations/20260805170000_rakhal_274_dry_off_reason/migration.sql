-- RAKHAL-274: optional structured reason for a dry-off. Purely additive —
-- new enum type + nullable column on the existing `DryPeriod` model, no
-- default (unknown historical reason should stay null, not guess).

CREATE TYPE "DryOffReason" AS ENUM ('SCHEDULED', 'LOW_PRODUCTION', 'HEALTH', 'PREGNANCY', 'MANAGEMENT_DECISION');

ALTER TABLE "DryPeriod" ADD COLUMN "reason" "DryOffReason";
