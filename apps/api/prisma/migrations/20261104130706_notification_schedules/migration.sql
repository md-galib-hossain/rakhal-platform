-- CreateEnum
CREATE TYPE "NotificationOrigin" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "ScheduleTrigger" AS ENUM ('DATE', 'BEFORE_EVENT', 'AFTER_EVENT', 'SOURCE_DUE');

-- CreateEnum
CREATE TYPE "ScheduleRepeat" AS ENUM ('NONE', 'EVERY_N_DAYS', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleAudienceMode" AS ENUM ('SOURCE', 'USER', 'ROLES', 'USERS');

-- CreateEnum
CREATE TYPE "ScheduleSourceType" AS ENUM ('TASK', 'HEALTH_STEP');

-- CreateEnum
CREATE TYPE "ScheduleAnchorType" AS ENUM ('ANIMAL_EVENT', 'TASK', 'HEALTH_STEP');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('SCHEDULED', 'FIRED', 'SKIPPED', 'CANCELLED');

-- DropIndex

-- CreateTable
CREATE TABLE "NotificationSchedule" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "origin" "NotificationOrigin" NOT NULL,
    "createdBy" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "body" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "trigger" "ScheduleTrigger" NOT NULL,
    "baseAnchorAt" TIMESTAMP(3) NOT NULL,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "sendTime" TEXT NOT NULL DEFAULT '08:00',
    "leadMinutes" INTEGER[],
    "offsetDays" INTEGER,
    "repeat" "ScheduleRepeat" NOT NULL DEFAULT 'NONE',
    "repeatInterval" INTEGER,
    "repeatEndDate" TIMESTAMP(3),
    "seriesIndex" INTEGER NOT NULL DEFAULT 0,
    "audienceMode" "ScheduleAudienceMode" NOT NULL,
    "audienceUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "animalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceType" "ScheduleSourceType",
    "sourceKey" TEXT,
    "anchorType" "ScheduleAnchorType",
    "anchorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOccurrence" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "leadMinutes" INTEGER NOT NULL,
    "fireAt" TIMESTAMP(3) NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "firedAt" TIMESTAMP(3),
    "recipientCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationSchedule_farmId_status_idx" ON "NotificationSchedule"("farmId", "status");

-- CreateIndex
CREATE INDEX "NotificationSchedule_farmId_origin_createdBy_idx" ON "NotificationSchedule"("farmId", "origin", "createdBy");

-- CreateIndex
CREATE INDEX "NotificationSchedule_anchorType_anchorId_idx" ON "NotificationSchedule"("anchorType", "anchorId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSchedule_farmId_sourceType_sourceKey_key" ON "NotificationSchedule"("farmId", "sourceType", "sourceKey");

-- CreateIndex
CREATE INDEX "NotificationOccurrence_status_fireAt_idx" ON "NotificationOccurrence"("status", "fireAt");

-- CreateIndex
CREATE INDEX "NotificationOccurrence_scheduleId_status_fireAt_idx" ON "NotificationOccurrence"("scheduleId", "status", "fireAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOccurrence_scheduleId_anchorAt_leadMinutes_key" ON "NotificationOccurrence"("scheduleId", "anchorAt", "leadMinutes");

-- AddForeignKey
ALTER TABLE "NotificationSchedule" ADD CONSTRAINT "NotificationSchedule_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOccurrence" ADD CONSTRAINT "NotificationOccurrence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "NotificationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
