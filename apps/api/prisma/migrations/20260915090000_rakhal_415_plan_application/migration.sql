-- CreateEnum
CREATE TYPE "PlanEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "HealthTask" DROP CONSTRAINT "HealthTask_healthCaseId_fkey";

-- AlterTable
ALTER TABLE "HealthTask" ADD COLUMN     "planEnrollmentId" TEXT,
ALTER COLUMN "healthCaseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlanApplication" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "healthPlanId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "animalCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEnrollment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "healthPlanId" TEXT NOT NULL,
    "planApplicationId" TEXT NOT NULL,
    "status" "PlanEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanApplication_farmId_healthPlanId_idx" ON "PlanApplication"("farmId", "healthPlanId");

-- CreateIndex
CREATE INDEX "PlanApplication_farmId_startDate_idx" ON "PlanApplication"("farmId", "startDate");

-- CreateIndex
CREATE INDEX "PlanEnrollment_farmId_cattleId_idx" ON "PlanEnrollment"("farmId", "cattleId");

-- CreateIndex
CREATE INDEX "PlanEnrollment_farmId_healthPlanId_idx" ON "PlanEnrollment"("farmId", "healthPlanId");

-- CreateIndex
CREATE INDEX "PlanEnrollment_farmId_planApplicationId_idx" ON "PlanEnrollment"("farmId", "planApplicationId");

-- CreateIndex
CREATE INDEX "PlanEnrollment_farmId_status_idx" ON "PlanEnrollment"("farmId", "status");

-- CreateIndex
CREATE INDEX "HealthTask_farmId_planEnrollmentId_idx" ON "HealthTask"("farmId", "planEnrollmentId");

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "HealthCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTask" ADD CONSTRAINT "HealthTask_planEnrollmentId_fkey" FOREIGN KEY ("planEnrollmentId") REFERENCES "PlanEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_appliedBy_fkey" FOREIGN KEY ("appliedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_healthPlanId_fkey" FOREIGN KEY ("healthPlanId") REFERENCES "HealthPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEnrollment" ADD CONSTRAINT "PlanEnrollment_planApplicationId_fkey" FOREIGN KEY ("planApplicationId") REFERENCES "PlanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

