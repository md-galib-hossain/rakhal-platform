-- RAKHAL-418 (2/2): run only after `prisma/rakhal-418-migrate-care-type.ts` has backfilled every
-- row's `careType` (confirmed: 37 rows found, 34 CURATIVE + 3 PREVENTIVE, 0 remaining afterward).

ALTER TABLE "HealthCase" ALTER COLUMN "careType" SET NOT NULL;

-- `diagnosisType` is fully superseded by `careType` now that every row has one; no other table or
-- column references `HealthDiagnosisType` (confirmed via a repo-wide grep of prisma/schemas), so
-- both the column and its Postgres enum type are safe to drop outright.
ALTER TABLE "HealthCase" DROP COLUMN "diagnosisType";
DROP TYPE "HealthDiagnosisType";
