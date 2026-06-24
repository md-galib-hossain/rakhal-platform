-- CreateEnum
CREATE TYPE "ActivityLogModule" AS ENUM ('COW_MANAGEMENT', 'MILK_PRODUCTION', 'HEALTH_SAFETY', 'FINANCE', 'BREEDING', 'INVENTORY', 'GENERAL');

-- AlterTable
ALTER TABLE "Cattle" ADD COLUMN     "aqrScore" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "module" "ActivityLogModule" NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "actionDetails" TEXT NOT NULL,
    "taggedValues" JSONB,
    "aqrImpact" DOUBLE PRECISION,
    "financialImpact" DOUBLE PRECISION,
    "actorId" TEXT,
    "relatedCattleId" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_farmId_timestamp_idx" ON "ActivityLog"("farmId", "timestamp");

-- CreateIndex
CREATE INDEX "ActivityLog_module_idx" ON "ActivityLog"("module");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_relatedCattleId_idx" ON "ActivityLog"("relatedCattleId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
