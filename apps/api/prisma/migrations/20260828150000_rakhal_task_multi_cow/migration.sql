-- Task multi-cow targeting (user request, no ticket #).
-- Additive: new join table only, Task.relatedCattleId untouched.

CREATE TABLE "TaskCattle" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCattle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskCattle_taskId_cattleId_key" ON "TaskCattle"("taskId", "cattleId");

CREATE INDEX "TaskCattle_cattleId_idx" ON "TaskCattle"("cattleId");

ALTER TABLE "TaskCattle" ADD CONSTRAINT "TaskCattle_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
