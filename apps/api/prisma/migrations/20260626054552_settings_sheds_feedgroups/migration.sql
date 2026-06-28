-- CreateEnum
CREATE TYPE "ShedPurpose" AS ENUM ('MILKING', 'HEIFER', 'DRY', 'CALF', 'QUARANTINE', 'GENERAL');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "district" TEXT,
ADD COLUMN     "division" TEXT,
ADD COLUMN     "operationalPurpose" TEXT,
ADD COLUMN     "upazila" TEXT;

-- AlterTable
ALTER TABLE "Shed" ADD COLUMN     "purpose" "ShedPurpose" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "responsibleMemberId" TEXT;

-- CreateTable
CREATE TABLE "FeedGroup" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedGroup_farmId_idx" ON "FeedGroup"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedGroup_farmId_name_key" ON "FeedGroup"("farmId", "name");

-- AddForeignKey
ALTER TABLE "Cattle" ADD CONSTRAINT "Cattle_feedGroupId_fkey" FOREIGN KEY ("feedGroupId") REFERENCES "FeedGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shed" ADD CONSTRAINT "Shed_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedGroup" ADD CONSTRAINT "FeedGroup_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
