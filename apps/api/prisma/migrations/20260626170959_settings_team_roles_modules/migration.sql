-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "FarmInvitation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "roleId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmModuleSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleIdFormat" TEXT NOT NULL DEFAULT '{TAG}-{SERIAL}',
    "cattleTagPrefix" TEXT,
    "cattleAvgMilkTargetRange" TEXT,
    "milkActiveSessions" TEXT[] DEFAULT ARRAY['morning', 'evening']::TEXT[],
    "milkMorningStart" TEXT NOT NULL DEFAULT '06:00',
    "milkMorningEnd" TEXT NOT NULL DEFAULT '11:59',
    "milkNoonStart" TEXT NOT NULL DEFAULT '12:00',
    "milkNoonEnd" TEXT NOT NULL DEFAULT '14:59',
    "milkEveningStart" TEXT NOT NULL DEFAULT '15:00',
    "milkEveningEnd" TEXT NOT NULL DEFAULT '17:59',
    "milkNightStart" TEXT NOT NULL DEFAULT '18:00',
    "milkNightEnd" TEXT NOT NULL DEFAULT '23:59',
    "milkUnit" TEXT NOT NULL DEFAULT 'litres',
    "milkAnomalyThresholdPct" INTEGER NOT NULL DEFAULT 30,
    "reproVwpDays" INTEGER NOT NULL DEFAULT 60,
    "reproTargetCalvingIntervalDays" INTEGER NOT NULL DEFAULT 380,
    "reproDryPeriodTargetDays" INTEGER NOT NULL DEFAULT 60,
    "financeCurrency" TEXT NOT NULL DEFAULT 'Tk',
    "financeCurrencySymbol" TEXT NOT NULL DEFAULT '৳',
    "financeRunwayWarningDays" INTEGER NOT NULL DEFAULT 20,
    "financeRunwayCriticalDays" INTEGER NOT NULL DEFAULT 10,
    "financeYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "healthScoreWarningPct" INTEGER NOT NULL DEFAULT 70,
    "healthSccAlertThreshold" INTEGER NOT NULL DEFAULT 200000,
    "healthMorbidityOutbreakPct" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmModuleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FarmInvitation_token_key" ON "FarmInvitation"("token");

-- CreateIndex
CREATE INDEX "FarmInvitation_farmId_idx" ON "FarmInvitation"("farmId");

-- CreateIndex
CREATE INDEX "FarmInvitation_farmId_status_idx" ON "FarmInvitation"("farmId", "status");

-- CreateIndex
CREATE INDEX "FarmInvitation_roleId_idx" ON "FarmInvitation"("roleId");

-- CreateIndex
CREATE INDEX "FarmInvitation_invitedById_idx" ON "FarmInvitation"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "FarmModuleSettings_farmId_key" ON "FarmModuleSettings"("farmId");

-- CreateIndex
CREATE INDEX "Supplier_farmId_idx" ON "Supplier"("farmId");

-- CreateIndex
CREATE INDEX "Supplier_farmId_isActive_idx" ON "Supplier"("farmId", "isActive");

-- AddForeignKey
ALTER TABLE "FarmInvitation" ADD CONSTRAINT "FarmInvitation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInvitation" ADD CONSTRAINT "FarmInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInvitation" ADD CONSTRAINT "FarmInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmModuleSettings" ADD CONSTRAINT "FarmModuleSettings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
