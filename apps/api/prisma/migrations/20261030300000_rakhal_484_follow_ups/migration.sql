-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "followUpKey" TEXT,
ADD COLUMN     "ruleKey" TEXT;

-- CreateTable
CREATE TABLE "FollowUpRuleSetting" (
    "farmId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "offsetDays" DOUBLE PRECISION,

    CONSTRAINT "FollowUpRuleSetting_pkey" PRIMARY KEY ("farmId","ruleKey")
);

-- CreateTable
CREATE TABLE "AnimalEventTypeDef" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "appliesTo" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "followUpDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalEventTypeDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalEventTypeDef_farmId_name_key" ON "AnimalEventTypeDef"("farmId", "name");


-- RAKHAL-484: one open follow-up per (farm, followUpKey); closed/cancelled tasks do not block a new one.
CREATE UNIQUE INDEX "Task_followUpKey_open_key" ON "Task"("farmId", "followUpKey")
  WHERE "followUpKey" IS NOT NULL AND "status" IN ('PENDING', 'IN_PROGRESS', 'BLOCKED');
-- Look-ups by animal + rule when an event closes follow-ups.
CREATE INDEX "Task_relatedCattleId_ruleKey_idx" ON "Task"("relatedCattleId", "ruleKey");
