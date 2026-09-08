-- RAKHAL-409 — requirement settings as data (PRD §12.13).
--
-- Hand-authored, following the precedent set by `20260905090000_milk_tank_primary`:
-- `prisma migrate dev`'s shadow-DB diff refuses to run because an earlier migration's
-- checksum drifted (`20260827100000_soft_delete_deletedat_migration`, edited after it was
-- applied — unrelated to this change) and demands a full `migrate reset` of the shared dev
-- database. Applying directly + `migrate resolve --applied` instead.
--
-- Purely additive: two new tables and one new foreign key. No existing table, column or row
-- is touched, so no farm's numbers change. With zero `RequirementPreset` rows every farm
-- resolves the built-in defaults in `domain/requirement-settings.ts`, which is the
-- migration-safety property this design relies on.

CREATE TABLE "RequirementPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmRequirementSettings" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "presetId" TEXT,
    "changes" JSONB NOT NULL,
    "notes" TEXT,
    "updatedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmRequirementSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequirementPreset_name_version_key" ON "RequirementPreset"("name", "version");
CREATE INDEX "RequirementPreset_isActive_effectiveFrom_idx" ON "RequirementPreset"("isActive", "effectiveFrom");

CREATE UNIQUE INDEX "FarmRequirementSettings_farmId_key" ON "FarmRequirementSettings"("farmId");
CREATE INDEX "FarmRequirementSettings_farmId_idx" ON "FarmRequirementSettings"("farmId");

ALTER TABLE "FarmRequirementSettings"
  ADD CONSTRAINT "FarmRequirementSettings_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FarmRequirementSettings"
  ADD CONSTRAINT "FarmRequirementSettings_presetId_fkey"
  FOREIGN KEY ("presetId") REFERENCES "RequirementPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only one preset may be active at a time. Prisma cannot express a filtered index, so this
-- is added by hand; the Admin activate path also does the deactivate+activate in one
-- transaction. Belt and braces, because a second active preset would make which numbers a
-- farm gets depend on row order.
CREATE UNIQUE INDEX "RequirementPreset_single_active"
  ON "RequirementPreset" ("isActive") WHERE "isActive" = true;
