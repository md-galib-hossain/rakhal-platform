-- RAKHAL-299: Edit substrate — back-link columns.
-- Purely additive: three new nullable columns (Pregnancy.sourceDiagnosisId,
-- Task.sourceEventType/sourceEventId, ActivityLog.previousAqrScore) plus
-- `updatedAt` on the 8 reproduction event models that previously carried
-- only `createdAt`. No value is guessed for the new nullable columns.
-- `updatedAt` is NOT NULL (Prisma's `@updatedAt` requirement) — existing
-- rows are backfilled to their own `createdAt`, which is literally true:
-- no edit path exists yet, so every existing row's last-known state is its
-- creation. Hand-authored (`prisma migrate dev` refuses non-interactively,
-- same as RAKHAL-298's precedent).

-- AlterTable: HeatEvent.updatedAt
ALTER TABLE "HeatEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "HeatEvent" SET "updatedAt" = "createdAt";
ALTER TABLE "HeatEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: BreedingEvent.updatedAt
ALTER TABLE "BreedingEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "BreedingEvent" SET "updatedAt" = "createdAt";
ALTER TABLE "BreedingEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: PregnancyDiagnosis.updatedAt
ALTER TABLE "PregnancyDiagnosis" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "PregnancyDiagnosis" SET "updatedAt" = "createdAt";
ALTER TABLE "PregnancyDiagnosis" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: Pregnancy.sourceDiagnosisId + updatedAt
ALTER TABLE "Pregnancy" ADD COLUMN     "sourceDiagnosisId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Pregnancy" SET "updatedAt" = "createdAt";
ALTER TABLE "Pregnancy" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Pregnancy_sourceDiagnosisId_idx" ON "Pregnancy"("sourceDiagnosisId");

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_sourceDiagnosisId_fkey" FOREIGN KEY ("sourceDiagnosisId") REFERENCES "PregnancyDiagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: CalvingEvent.updatedAt
ALTER TABLE "CalvingEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "CalvingEvent" SET "updatedAt" = "createdAt";
ALTER TABLE "CalvingEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: AbortionEvent.updatedAt
ALTER TABLE "AbortionEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "AbortionEvent" SET "updatedAt" = "createdAt";
ALTER TABLE "AbortionEvent" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: DryPeriod.updatedAt
ALTER TABLE "DryPeriod" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "DryPeriod" SET "updatedAt" = "createdAt";
ALTER TABLE "DryPeriod" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: Lactation.updatedAt
ALTER TABLE "Lactation" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Lactation" SET "updatedAt" = "createdAt";
ALTER TABLE "Lactation" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: Task.sourceEventType/sourceEventId
ALTER TABLE "Task" ADD COLUMN     "sourceEventType" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- CreateIndex
CREATE INDEX "Task_sourceEventType_sourceEventId_idx" ON "Task"("sourceEventType", "sourceEventId");

-- AlterTable: ActivityLog.previousAqrScore
ALTER TABLE "ActivityLog" ADD COLUMN     "previousAqrScore" DOUBLE PRECISION;
