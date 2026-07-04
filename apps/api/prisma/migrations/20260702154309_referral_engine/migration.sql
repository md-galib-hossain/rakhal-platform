-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'VOID');

-- CreateEnum
CREATE TYPE "CommissionRewardType" AS ENUM ('CREDIT', 'CASH');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CLAWED_BACK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REFERRAL_BOUND';
ALTER TYPE "AuditAction" ADD VALUE 'REFERRAL_COMMISSION_ACCRUED';
ALTER TYPE "AuditAction" ADD VALUE 'REFERRAL_CLAWED_BACK';

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referrerFarmId" TEXT NOT NULL,
    "referredFarmId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referrerFarmId" TEXT NOT NULL,
    "referredFarmId" TEXT NOT NULL,
    "triggerInvoiceId" TEXT NOT NULL,
    "rewardType" "CommissionRewardType" NOT NULL DEFAULT 'CREDIT',
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "clawedBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_farmId_idx" ON "ReferralCode"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredFarmId_key" ON "Referral"("referredFarmId");

-- CreateIndex
CREATE INDEX "Referral_referrerFarmId_idx" ON "Referral"("referrerFarmId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_idempotencyKey_key" ON "ReferralCommission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReferralCommission_referrerFarmId_idx" ON "ReferralCommission"("referrerFarmId");

-- CreateIndex
CREATE INDEX "ReferralCommission_status_idx" ON "ReferralCommission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_farmId_key" ON "CreditWallet"("farmId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
