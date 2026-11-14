-- RAKHAL-452: replace Feed Group with Animal Group (many-to-many). Drops all feed-group data.

-- 1) GROUP-targeted concentrations become herd-wide before the enum value is dropped.
UPDATE "FeedConcentration" SET "targetType" = 'HERD' WHERE "targetType" = 'GROUP';

-- 2) Drop feedGroupId columns (indexes go with them).
DROP INDEX IF EXISTS "FeedConcentration_farmId_feedGroupId_idx";
DROP INDEX IF EXISTS "FeedDistribution_farmId_feedGroupId_idx";
ALTER TABLE "FeedConcentration" DROP COLUMN IF EXISTS "feedGroupId";
ALTER TABLE "FeedDistribution" DROP COLUMN IF EXISTS "feedGroupId";
ALTER TABLE "FeedDistributionCattleItem" DROP COLUMN IF EXISTS "feedGroupId";
ALTER TABLE "FeedFeedingDraft" DROP COLUMN IF EXISTS "feedGroupId";
ALTER TABLE "Cattle" DROP CONSTRAINT IF EXISTS "Cattle_feedGroupId_fkey";
ALTER TABLE "Cattle" DROP COLUMN IF EXISTS "feedGroupId";

-- 3) Drop the FeedGroup table.
DROP TABLE IF EXISTS "FeedGroup" CASCADE;

-- 4) Drop enum value GROUP from FeedTargetType.
ALTER TYPE "FeedTargetType" RENAME TO "FeedTargetType_old";
CREATE TYPE "FeedTargetType" AS ENUM ('INDIVIDUAL', 'HERD');
ALTER TABLE "FeedConcentration" ALTER COLUMN "targetType" DROP DEFAULT;
ALTER TABLE "FeedConcentration"
  ALTER COLUMN "targetType" TYPE "FeedTargetType" USING ("targetType"::text::"FeedTargetType");
ALTER TABLE "FeedConcentration" ALTER COLUMN "targetType" SET DEFAULT 'HERD';
DROP TYPE "FeedTargetType_old";

-- 5) Animal groups.
CREATE TABLE "AnimalGroup" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalGroupMember" (
    "groupId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalGroupMember_pkey" PRIMARY KEY ("groupId","cattleId")
);

CREATE UNIQUE INDEX "AnimalGroup_farmId_name_key" ON "AnimalGroup"("farmId", "name");
CREATE INDEX "AnimalGroup_farmId_idx" ON "AnimalGroup"("farmId");
CREATE INDEX "AnimalGroupMember_cattleId_idx" ON "AnimalGroupMember"("cattleId");
CREATE INDEX "AnimalGroupMember_farmId_idx" ON "AnimalGroupMember"("farmId");

ALTER TABLE "AnimalGroup" ADD CONSTRAINT "AnimalGroup_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnimalGroupMember" ADD CONSTRAINT "AnimalGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalGroupMember" ADD CONSTRAINT "AnimalGroupMember_cattleId_fkey"
  FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
