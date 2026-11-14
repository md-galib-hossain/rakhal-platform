-- RAKHAL-278: `FarmModuleSettings.milkColostrumWindowDays` (colostrum-window
-- length feeding `deriveMilkEligibility()`'s COLOSTRUM check, milk-eligibility.ts)
-- was added to `prisma/schemas/settings/farm-module-settings.prisma` by the
-- RAKHAL-277/278 milk-eligibility work but no migration was ever generated for
-- it — a genuine gap discovered while integrating RAKHAL-279 (`prisma migrate
-- status` reported "up to date" yet every live `FarmSettingsService.getEffective()`
-- call 500'd with "column does not exist", since `getEffective()` does a plain
-- `findUnique` with no `select`, so ANY missing column on this row breaks EVERY
-- caller — not just milk, but also every already-shipped reproduction-alert/
-- stage read (RAKHAL-271/272/273) and this ticket's `composeStatus()`
-- enrichment). Purely additive — mirrors RAKHAL-272's own
-- `20260805160000_rakhal_272_reproduction_alert_settings` migration exactly:
-- a NOT NULL DEFAULT column matching the schema's `@default(5)`.

ALTER TABLE "FarmModuleSettings" ADD COLUMN "milkColostrumWindowDays" INTEGER NOT NULL DEFAULT 5;
