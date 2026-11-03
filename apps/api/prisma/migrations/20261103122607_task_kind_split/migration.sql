-- RAKHAL-491: split "task" from "reminder" on the one Task table.
-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('TASK', 'REMINDER');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'TASK';

-- Backfill: every legacy category=REMINDER row becomes kind=REMINDER with the general topic.
-- (The deprecated REMINDER enum value stays; it is no longer written.)
UPDATE "Task" SET "kind" = 'REMINDER', "category" = 'GENERAL' WHERE "category" = 'REMINDER';

-- CreateIndex
CREATE INDEX "Task_farmId_kind_status_dueAt_idx" ON "Task"("farmId", "kind", "status", "dueAt");
