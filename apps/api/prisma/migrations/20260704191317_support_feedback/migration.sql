-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('BUG', 'FEATURE_REQUEST', 'QUESTION', 'BILLING', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- AlterEnum
ALTER TYPE "MediaCategory" ADD VALUE 'SUPPORT';

-- AlterEnum
ALTER TYPE "MediaUsage" ADD VALUE 'FEEDBACK_SCREENSHOT';

-- CreateTable
CREATE TABLE "SupportFeedback" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "screenshotAssetId" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "resolvedByAdminId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportFeedback_status_createdAt_idx" ON "SupportFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportFeedback_farmId_idx" ON "SupportFeedback"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialGrant_userId_key" ON "TrialGrant"("userId");
