-- RAKHAL-405: Task lifecycle hardening
-- Additive only: new enum value + 4 nullable columns. No backfill needed.

ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "Task"
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "completionNote" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT;
