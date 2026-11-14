-- CreateEnum
CREATE TYPE "FeedFitSeverity" AS ENUM ('OK', 'WARN', 'BAD');

-- CreateTable
CREATE TABLE "FeedPlanFitDay" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "severity" "FeedFitSeverity" NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedPlanFitDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedPlanFitDay_farmId_date_idx" ON "FeedPlanFitDay"("farmId", "date");

-- CreateIndex
CREATE INDEX "FeedPlanFitDay_planId_date_idx" ON "FeedPlanFitDay"("planId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FeedPlanFitDay_planId_cattleId_date_key" ON "FeedPlanFitDay"("planId", "cattleId", "date");

-- AddForeignKey
ALTER TABLE "FeedPlanFitDay" ADD CONSTRAINT "FeedPlanFitDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeedPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
