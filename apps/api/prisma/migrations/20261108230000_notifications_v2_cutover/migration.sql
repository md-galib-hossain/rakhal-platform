-- RAKHAL-499 (NV2-B08): Notifications V2 cutover. DESTRUCTIVE and irreversible (owner-approved 2026-11-08, pre-launch,
-- LOCAL dev DB, no data migration). Hand-authored because dropping enum values needs the enums recreated.
-- Order matters: data deletes first so no surviving row can violate a recreated enum.

-- 1. Delete data of the retired reminder system -------------------------------------------------------------------
-- Schedules built for rule-task groups point at tasks that are deleted just below (occurrences cascade).
DELETE FROM "NotificationSchedule" WHERE "sourceType" = 'TASK' AND "sourceKey" LIKE 'rule:%';

-- Custom reminders (kind = REMINDER) and every follow-up-rule task; TaskCattle and TaskAuditLog cascade.
DELETE FROM "Task" WHERE "kind" = 'REMINDER' OR "ruleKey" IS NOT NULL;

-- Delivered notices and per-user preferences of the seven retired event keys.
DELETE FROM "Notification" WHERE "eventKey" IN (
  'follow_up_upcoming', 'follow_up_due_today', 'follow_up_overdue',
  'health_task_reminder', 'health_task_due_tomorrow', 'health_task_due_today', 'health_task_overdue'
);
DELETE FROM "NotificationPreference" WHERE "eventKey" IN (
  'follow_up_upcoming', 'follow_up_due_today', 'follow_up_overdue',
  'health_task_reminder', 'health_task_due_tomorrow', 'health_task_due_today', 'health_task_overdue'
);

-- Defensive: no surviving row may hold a value that is about to disappear from an enum.
UPDATE "Task" SET "category" = 'GENERAL' WHERE "category" = 'REMINDER';
UPDATE "Task" SET "recurring" = false, "recurrenceType" = NULL WHERE "recurrenceType" = 'EVERY_N_DAYS';

-- 2. Task index: [farmId, kind, status, dueAt] -> [farmId, status, dueAt] --------------------------------------------
DROP INDEX "Task_farmId_kind_status_dueAt_idx";
CREATE INDEX "Task_farmId_status_dueAt_idx" ON "Task"("farmId", "status", "dueAt");

-- 3. Drop TaskRecipient and the reminder columns of Task ---------------------------------------------------------
DROP TABLE "TaskRecipient";

ALTER TABLE "Task"
  DROP COLUMN "kind",
  DROP COLUMN "remindDaysBefore",
  DROP COLUMN "reminderOffsetDays",
  DROP COLUMN "notifyRoleNames",
  DROP COLUMN "spawnedNextAt",
  DROP COLUMN "recurrenceIntervalDays";

DROP TYPE "TaskKind";

-- 4. Recreate TaskCategory without REMINDER ----------------------------------------------------------------------
CREATE TYPE "TaskCategory_new" AS ENUM ('FEEDING', 'HEALTHCARE', 'BREEDING', 'MAINTENANCE', 'MILKING', 'CALF_CARE', 'GENERAL');
ALTER TABLE "Task" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "category" TYPE "TaskCategory_new" USING ("category"::text::"TaskCategory_new");
ALTER TABLE "Task" ALTER COLUMN "category" SET DEFAULT 'GENERAL';
DROP TYPE "TaskCategory";
ALTER TYPE "TaskCategory_new" RENAME TO "TaskCategory";

-- 5. Recreate TaskRecurrence without EVERY_N_DAYS ------------------------------------------------------------------
CREATE TYPE "TaskRecurrence_new" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
ALTER TABLE "Task" ALTER COLUMN "recurrenceType" TYPE "TaskRecurrence_new" USING ("recurrenceType"::text::"TaskRecurrence_new");
DROP TYPE "TaskRecurrence";
ALTER TYPE "TaskRecurrence_new" RENAME TO "TaskRecurrence";
