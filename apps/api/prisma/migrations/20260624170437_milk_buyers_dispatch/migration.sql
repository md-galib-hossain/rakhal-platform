-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('DAIRY_COMPANY', 'COOPERATIVE', 'LOCAL_TRADER', 'DIRECT_CONSUMER');

-- CreateTable
CREATE TABLE "MilkBuyer" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "buyerType" "BuyerType" NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "basePricePerLitre" DOUBLE PRECISION NOT NULL,
    "baseFatPct" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "fatBonusPer01Pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sccThreshold" INTEGER NOT NULL DEFAULT 200000,
    "sccPenaltyPer100k" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectionDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collectionTime" TEXT,
    "bankDetails" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkDispatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "volumeDispatchedL" DOUBLE PRECISION NOT NULL,
    "volumeReceivedL" DOUBLE PRECISION,
    "fatPct" DOUBLE PRECISION,
    "scc" INTEGER,
    "discrepancyL" DOUBLE PRECISION,
    "discrepancyFlagged" BOOLEAN NOT NULL DEFAULT false,
    "basePricePerLitre" DOUBLE PRECISION NOT NULL,
    "fatBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sccPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAmount" DOUBLE PRECISION NOT NULL,
    "paymentDueDate" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilkBuyer_farmId_idx" ON "MilkBuyer"("farmId");

-- CreateIndex
CREATE INDEX "MilkBuyer_farmId_isActive_idx" ON "MilkBuyer"("farmId", "isActive");

-- CreateIndex
CREATE INDEX "MilkDispatch_farmId_idx" ON "MilkDispatch"("farmId");

-- CreateIndex
CREATE INDEX "MilkDispatch_farmId_dispatchedAt_idx" ON "MilkDispatch"("farmId", "dispatchedAt");

-- CreateIndex
CREATE INDEX "MilkDispatch_buyerId_idx" ON "MilkDispatch"("buyerId");

-- AddForeignKey
ALTER TABLE "MilkBuyer" ADD CONSTRAINT "MilkBuyer_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkDispatch" ADD CONSTRAINT "MilkDispatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkDispatch" ADD CONSTRAINT "MilkDispatch_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "MilkBuyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
