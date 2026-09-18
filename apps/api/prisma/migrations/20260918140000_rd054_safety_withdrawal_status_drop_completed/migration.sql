-- RD-054 (docs/TECH_DEBT.md): drop `COMPLETED` from `SafetyWithdrawalStatus`.
-- Schema (prisma/schemas/health/health.enums.prisma) already reads
-- ACTIVE|READY_FOR_RELEASE|RELEASED|CANCELLED (dropped by RAKHAL-276, 2026-08-05, which
-- deliberately left the Postgres enum value in place — see that migration's own comment)
-- but the DB type was never brought in line. Pre-checked live data before writing this file:
-- zero `SafetyWithdrawal` rows hold `COMPLETED` (checked via direct psql GROUP BY), and no
-- application code writes `SafetyWithdrawalStatus.COMPLETED` (the only other `COMPLETED` hits
-- in src/modules/health are the unrelated `HealthTaskStatus`/`PlanEnrollmentStatus` enums).
-- Postgres can't drop an enum value directly, so swap the column onto a rebuilt type.

BEGIN;

CREATE TYPE "SafetyWithdrawalStatus_new" AS ENUM ('ACTIVE', 'READY_FOR_RELEASE', 'RELEASED', 'CANCELLED');

ALTER TABLE "SafetyWithdrawal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SafetyWithdrawal" ALTER COLUMN "status" TYPE "SafetyWithdrawalStatus_new"
  USING ("status"::text::"SafetyWithdrawalStatus_new");
ALTER TABLE "SafetyWithdrawal" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "SafetyWithdrawalStatus";
ALTER TYPE "SafetyWithdrawalStatus_new" RENAME TO "SafetyWithdrawalStatus";

COMMIT;
