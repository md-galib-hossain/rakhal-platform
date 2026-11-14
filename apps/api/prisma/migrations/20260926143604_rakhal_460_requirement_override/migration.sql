-- CreateEnum
CREATE TYPE "RequirementOverrideEndReason" AS ENUM ('REPLACED', 'TURNED_OFF');

-- CreateTable
CREATE TABLE "CattleRequirementOverride" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "dmKg" DOUBLE PRECISION NOT NULL,
    "cpKg" DOUBLE PRECISION NOT NULL,
    "meMj" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "dynamicSnapshot" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "endReason" "RequirementOverrideEndReason",
    "setBy" TEXT NOT NULL,
    "endedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CattleRequirementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CattleRequirementOverride_farmId_cattleId_effectiveFrom_idx" ON "CattleRequirementOverride"("farmId", "cattleId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "CattleRequirementOverride" ADD CONSTRAINT "CattleRequirementOverride_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CattleRequirementOverride" ADD CONSTRAINT "CattleRequirementOverride_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RAKHAL-460: guards Prisma cannot express (same technique as FeedPlanAssignment).
ALTER TABLE "CattleRequirementOverride"
  ADD CONSTRAINT "CattleRequirementOverride_values_valid" CHECK (
    "dmKg" > 0 AND "cpKg" > 0 AND "meMj" > 0 AND "cpKg" < "dmKg"
  );

-- At most one OPEN (manual-on) row per cow.
CREATE UNIQUE INDEX "CattleRequirementOverride_open_key"
  ON "CattleRequirementOverride" ("farmId", "cattleId")
  WHERE "effectiveTo" IS NULL;
