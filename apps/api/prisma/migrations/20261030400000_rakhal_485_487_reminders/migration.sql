-- RAKHAL-487: custom reminders on the Task Hub.
ALTER TYPE "TaskCategory" ADD VALUE IF NOT EXISTS 'REMINDER';
ALTER TYPE "TaskRecurrence" ADD VALUE IF NOT EXISTS 'EVERY_N_DAYS';

ALTER TABLE "Task"
  ADD COLUMN "remindDaysBefore" INTEGER,
  ADD COLUMN "notifyRoleNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reminderOffsetDays" INTEGER,
  ADD COLUMN "recurrenceIntervalDays" INTEGER,
  ADD COLUMN "spawnedNextAt" TIMESTAMP(3);

CREATE TABLE "TaskRecipient" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskRecipient_taskId_userId_key" ON "TaskRecipient"("taskId", "userId");
CREATE INDEX "TaskRecipient_userId_idx" ON "TaskRecipient"("userId");
ALTER TABLE "TaskRecipient" ADD CONSTRAINT "TaskRecipient_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sweep look-up: open tasks that a rule or a reminder produced.
CREATE INDEX "Task_ruleKey_dueAt_idx" ON "Task"("ruleKey", "dueAt") WHERE "ruleKey" IS NOT NULL;

-- RAKHAL-485: the four bespoke reminder events become three follow-up events.
-- A user's opt-outs carry over: a new key is enabled/on-channel only if every old key they held was.
INSERT INTO "NotificationPreference"
  ("id","farmId","userId","eventKey","enabled","inApp","push","sms","whatsapp","telegram","email","createdAt","updatedAt")
SELECT gen_random_uuid()::text, o."farmId", o."userId", k."key",
       bool_and(o."enabled"), bool_and(o."inApp"), bool_and(o."push"), bool_and(o."sms"),
       bool_and(o."whatsapp"), bool_and(o."telegram"), bool_and(o."email"), now(), now()
FROM "NotificationPreference" o
CROSS JOIN (VALUES ('follow_up_upcoming'),('follow_up_due_today'),('follow_up_overdue')) AS k("key")
WHERE o."eventKey" IN ('calving_expected_3_days','cow_expected_in_heat','pregnancy_check_due','dry_off_due_14_days')
GROUP BY o."farmId", o."userId", k."key"
ON CONFLICT ("userId","eventKey") DO NOTHING;

DELETE FROM "NotificationPreference"
WHERE "eventKey" IN ('calving_expected_3_days','cow_expected_in_heat','pregnancy_check_due','dry_off_due_14_days');
