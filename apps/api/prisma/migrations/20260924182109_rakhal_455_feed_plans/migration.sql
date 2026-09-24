-- CreateEnum
CREATE TYPE "FeedPlanKind" AS ENUM ('PLAN', 'TMR_SHORTCUT', 'CONCENTRATE_SHORTCUT');

-- CreateEnum
CREATE TYPE "FeedPlanLineType" AS ENUM ('FEED_ITEM', 'PREPARED');

-- CreateTable
CREATE TABLE "FeedPlan" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FeedPlanKind" NOT NULL DEFAULT 'PLAN',
    "notes" TEXT,
    "madeForCattleId" TEXT,
    "madeForAnimalGroupId" TEXT,
    "referenceRequirement" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPlanLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lineType" "FeedPlanLineType" NOT NULL,
    "feedItemId" TEXT,
    "concentrationId" TEXT,
    "kgPerDay" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeedPlanLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedPlan_farmId_isActive_idx" ON "FeedPlan"("farmId", "isActive");

-- CreateIndex
CREATE INDEX "FeedPlanLine_planId_idx" ON "FeedPlanLine"("planId");

-- CreateIndex
CREATE INDEX "FeedPlanLine_farmId_feedItemId_idx" ON "FeedPlanLine"("farmId", "feedItemId");

-- CreateIndex
CREATE INDEX "FeedPlanLine_farmId_concentrationId_idx" ON "FeedPlanLine"("farmId", "concentrationId");

-- AddForeignKey
ALTER TABLE "FeedPlan" ADD CONSTRAINT "FeedPlan_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPlanLine" ADD CONSTRAINT "FeedPlanLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeedPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RAKHAL-455: guards Prisma cannot express (same technique as FeedFeedingDraft / RD-089).
ALTER TABLE "FeedPlanLine"
  ADD CONSTRAINT "FeedPlanLine_kgPerDay_positive" CHECK ("kgPerDay" > 0),
  ADD CONSTRAINT "FeedPlanLine_one_target" CHECK (
    ("lineType" = 'FEED_ITEM' AND "feedItemId" IS NOT NULL AND "concentrationId" IS NULL)
    OR ("lineType" = 'PREPARED' AND "concentrationId" IS NOT NULL AND "feedItemId" IS NULL)
  );

-- One ACTIVE plan per (farm, case-insensitive name); an archived plan's name can be reused.
CREATE UNIQUE INDEX "FeedPlan_farmId_lower_name_active_key"
  ON "FeedPlan" ("farmId", lower("name")) WHERE "isActive";
