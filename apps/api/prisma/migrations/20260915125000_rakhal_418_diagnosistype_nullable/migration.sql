-- RAKHAL-418 (1.5/2): the `prepare` migration renamed `diagnosis` -> `note` and added `careType`,
-- but left the old `diagnosisType` column's NOT NULL constraint in place. Nothing writes to
-- `diagnosisType` anymore (removed from `schema.prisma`, from every `HealthCase.create()` call
-- site) so every insert has been violating that constraint since — a real functional break, caught
-- live by the e2e sweep (`prisma.healthCase.create()` 500ing with "Null constraint violation").
-- Loosening the constraint (not dropping the column yet — that's the `finalize` migration, pending
-- separately) is additive and fully reversible.

ALTER TABLE "HealthCase" ALTER COLUMN "diagnosisType" DROP NOT NULL;
