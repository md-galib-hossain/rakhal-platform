-- Remove Task checklist sub-steps feature (user decision, no ticket #).
-- Destructive but scoped: only the JSON checklist blob is dropped, nothing else on Task.

ALTER TABLE "Task" DROP COLUMN "steps";
