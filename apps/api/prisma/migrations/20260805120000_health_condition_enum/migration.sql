-- CreateEnum
CREATE TYPE "HealthCondition" AS ENUM ('MASTITIS', 'LAMENESS', 'METRITIS', 'KETOSIS', 'MILK_FEVER', 'FEVER', 'INJURY', 'OTHER');

-- AlterTable
ALTER TABLE "HealthCase" ADD COLUMN     "condition" "HealthCondition";

-- CreateIndex
CREATE INDEX "HealthCase_farmId_condition_idx" ON "HealthCase"("farmId", "condition");
