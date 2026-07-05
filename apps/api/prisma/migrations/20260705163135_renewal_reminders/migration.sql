-- CreateEnum
CREATE TYPE "RenewalStage" AS ENUM ('T_MINUS_7', 'T_MINUS_3', 'T_MINUS_1', 'EXPIRY_DAY', 'WINBACK_3', 'WINBACK_7', 'WINBACK_30');

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'SUBSCRIPTION_RENEWAL';

-- CreateTable
CREATE TABLE "RenewalReminder" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stage" "RenewalStage" NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenewalReminder_farmId_idx" ON "RenewalReminder"("farmId");

-- CreateIndex
CREATE INDEX "RenewalReminder_stage_createdAt_idx" ON "RenewalReminder"("stage", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalReminder_subscriptionId_stage_key" ON "RenewalReminder"("subscriptionId", "stage");
