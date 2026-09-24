-- CreateEnum
CREATE TYPE "FeedPlanTarget" AS ENUM ('INDIVIDUAL', 'GROUP', 'HERD');

-- CreateTable
CREATE TABLE "FeedPlanAssignment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "targetType" "FeedPlanTarget" NOT NULL,
    "cattleId" TEXT,
    "animalGroupId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedBy" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,

    CONSTRAINT "FeedPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedPlanAssignment_farmId_removedAt_idx" ON "FeedPlanAssignment"("farmId", "removedAt");

-- CreateIndex
CREATE INDEX "FeedPlanAssignment_planId_removedAt_idx" ON "FeedPlanAssignment"("planId", "removedAt");

-- CreateIndex
CREATE INDEX "FeedPlanAssignment_cattleId_idx" ON "FeedPlanAssignment"("cattleId");

-- CreateIndex
CREATE INDEX "FeedPlanAssignment_animalGroupId_idx" ON "FeedPlanAssignment"("animalGroupId");

-- AddForeignKey
ALTER TABLE "FeedPlanAssignment" ADD CONSTRAINT "FeedPlanAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeedPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RAKHAL-456: guards Prisma cannot express (same technique as FeedFeedingDraft / RD-089).
ALTER TABLE "FeedPlanAssignment"
  ADD CONSTRAINT "FeedPlanAssignment_target_matches_type" CHECK (
    ("targetType" = 'INDIVIDUAL' AND "cattleId" IS NOT NULL AND "animalGroupId" IS NULL)
    OR ("targetType" = 'GROUP' AND "animalGroupId" IS NOT NULL AND "cattleId" IS NULL)
    OR ("targetType" = 'HERD' AND "cattleId" IS NULL AND "animalGroupId" IS NULL)
  );

-- One ACTIVE assignment per target.
CREATE UNIQUE INDEX "FeedPlanAssignment_active_individual_key"
  ON "FeedPlanAssignment" ("farmId", "cattleId")
  WHERE "targetType" = 'INDIVIDUAL' AND "removedAt" IS NULL;
CREATE UNIQUE INDEX "FeedPlanAssignment_active_group_key"
  ON "FeedPlanAssignment" ("farmId", "animalGroupId")
  WHERE "targetType" = 'GROUP' AND "removedAt" IS NULL;
CREATE UNIQUE INDEX "FeedPlanAssignment_active_herd_key"
  ON "FeedPlanAssignment" ("farmId")
  WHERE "targetType" = 'HERD' AND "removedAt" IS NULL;
