-- MILESTONE 28b (RAKHAL-463): the full nutrient profile on a manual requirement override.
-- Additive and nullable: rows saved under v1 (DM/CP/ME only) keep null here and resolve exactly as before.

ALTER TABLE "CattleRequirementOverride"
    ADD COLUMN "ndfKg" DOUBLE PRECISION,
    ADD COLUMN "ndfMaxKg" DOUBLE PRECISION,
    ADD COLUMN "adfKg" DOUBLE PRECISION,
    ADD COLUMN "fatKg" DOUBLE PRECISION,
    ADD COLUMN "tdnKg" DOUBLE PRECISION,
    ADD COLUMN "calciumKg" DOUBLE PRECISION,
    ADD COLUMN "phosphorusKg" DOUBLE PRECISION,
    ADD COLUMN "rdpPct" DOUBLE PRECISION,
    ADD COLUMN "rupPct" DOUBLE PRECISION;

-- Null-safe sanity checks (a null passes). The full rules live in `validateManualValues`.
ALTER TABLE "CattleRequirementOverride"
    ADD CONSTRAINT "CattleRequirementOverride_profile_nonneg_check" CHECK (
        ("ndfKg" IS NULL OR "ndfKg" >= 0)
        AND ("ndfMaxKg" IS NULL OR "ndfMaxKg" >= 0)
        AND ("adfKg" IS NULL OR "adfKg" >= 0)
        AND ("fatKg" IS NULL OR "fatKg" >= 0)
        AND ("tdnKg" IS NULL OR "tdnKg" >= 0)
        AND ("calciumKg" IS NULL OR "calciumKg" >= 0)
        AND ("phosphorusKg" IS NULL OR "phosphorusKg" >= 0)
        AND ("rdpPct" IS NULL OR ("rdpPct" >= 0 AND "rdpPct" <= 100))
        AND ("rupPct" IS NULL OR ("rupPct" >= 0 AND "rupPct" <= 100))
        AND ("ndfKg" IS NULL OR "ndfMaxKg" IS NULL OR "ndfMaxKg" >= "ndfKg")
    );
