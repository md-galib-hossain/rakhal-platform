-- AlterEnum: add HERD target level (herd default -> group -> individual override)
ALTER TYPE "FeedTargetType" ADD VALUE 'HERD';

-- CreateEnum
CREATE TYPE "FeedDistributionSourceType" AS ENUM ('CONCENTRATION', 'QUICK_FEED');

-- AlterTable: FeedDistribution gains quick-feed + versioning support
ALTER TABLE "FeedDistribution" ALTER COLUMN "concentrationId" DROP NOT NULL;
ALTER TABLE "FeedDistribution" ADD COLUMN "concentrationVersionId" TEXT;
ALTER TABLE "FeedDistribution" ADD COLUMN "sourceType" "FeedDistributionSourceType" NOT NULL DEFAULT 'CONCENTRATION';

-- AlterTable: FeedGroup gains per-group refusal target
ALTER TABLE "FeedGroup" ADD COLUMN "refusalTargetPct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "FeedConcentrationVersion" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "concentrationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT,
    "snapshotItems" JSONB NOT NULL,
    "totalCostPerDay" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedConcentrationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedConcentrationVersion_concentrationId_versionNumber_key" ON "FeedConcentrationVersion"("concentrationId", "versionNumber");

-- CreateIndex
CREATE INDEX "FeedConcentrationVersion_farmId_idx" ON "FeedConcentrationVersion"("farmId");

-- CreateIndex
CREATE INDEX "FeedConcentrationVersion_concentrationId_idx" ON "FeedConcentrationVersion"("concentrationId");

-- AddForeignKey
ALTER TABLE "FeedConcentrationVersion" ADD CONSTRAINT "FeedConcentrationVersion_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedConcentrationVersion" ADD CONSTRAINT "FeedConcentrationVersion_concentrationId_fkey" FOREIGN KEY ("concentrationId") REFERENCES "FeedConcentration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
