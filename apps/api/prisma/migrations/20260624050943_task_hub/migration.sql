-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('FEEDING', 'HEALTHCARE', 'BREEDING', 'MAINTENANCE', 'MILKING', 'CALF_CARE', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'HEALTH_PLAN', 'SYSTEM_AUTO');

-- CreateEnum
CREATE TYPE "TaskRecurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "steps" JSONB,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" "TaskRecurrence",
    "recurrenceEndDate" TIMESTAMP(3),
    "safetyCritical" BOOLEAN NOT NULL DEFAULT false,
    "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "relatedCattleId" TEXT,
    "assignedToId" TEXT,
    "completionPhotoUrl" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_farmId_status_idx" ON "Task"("farmId", "status");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Task_category_idx" ON "Task"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Task_farmId_reference_key" ON "Task"("farmId", "reference");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
