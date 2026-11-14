-- FinancialAccount.isPrimary: the farm's default wallet (pre-selected in payment pickers).
ALTER TABLE "FinancialAccount" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: each farm's oldest live account becomes its primary wallet.
UPDATE "FinancialAccount"
SET "isPrimary" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("farmId") "id"
  FROM "FinancialAccount"
  WHERE "deletedAt" IS NULL
  ORDER BY "farmId", "createdAt" ASC, "id" ASC
);

-- MilkTank.isPrimary is now one per farm (was one per tankType). Keep each farm's most recently
-- updated live primary, clear the rest (and any archived tank still flagged primary).
UPDATE "MilkTank"
SET "isPrimary" = false
WHERE "isPrimary" = true
  AND ("deletedAt" IS NOT NULL OR "id" NOT IN (
    SELECT DISTINCT ON ("farmId") "id"
    FROM "MilkTank"
    WHERE "isPrimary" = true AND "deletedAt" IS NULL
    ORDER BY "farmId", "updatedAt" DESC, "id" ASC
  ));
