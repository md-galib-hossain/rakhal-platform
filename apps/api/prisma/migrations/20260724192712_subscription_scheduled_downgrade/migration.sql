-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_DOWNGRADE_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_DOWNGRADE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_DOWNGRADE_APPLIED';

-- AlterTable
ALTER TABLE "FarmSubscription" ADD COLUMN     "pendingBillingPeriod" "BillingPeriod",
ADD COLUMN     "pendingPlanId" TEXT,
ADD COLUMN     "pendingScheduledBy" TEXT;

-- CreateIndex
CREATE INDEX "FarmSubscription_pendingPlanId_idx" ON "FarmSubscription"("pendingPlanId");

-- AddForeignKey
ALTER TABLE "FarmSubscription" ADD CONSTRAINT "FarmSubscription_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
