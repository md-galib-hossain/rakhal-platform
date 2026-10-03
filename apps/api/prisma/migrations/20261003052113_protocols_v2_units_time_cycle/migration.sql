-- AlterTable
ALTER TABLE "HealthPlanStep" ADD COLUMN     "doseUnitId" TEXT,
ADD COLUMN     "timeOfDay" TEXT;

-- AlterTable
ALTER TABLE "HealthTask" ADD COLUMN     "doseUnitId" TEXT,
ADD COLUMN     "timeOfDay" TEXT;

-- AlterTable
ALTER TABLE "PlanEnrollment" ADD COLUMN     "cycleNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextCycleCreatedAt" TIMESTAMP(3),
ADD COLUMN     "repeatedFromId" TEXT;
