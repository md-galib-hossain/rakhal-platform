-- RAKHAL-451 (MILESTONE 26, D12): FeedStock nutrients move onto the shared immutable NutritionProfile.
-- 1) add the FK nullable, 2) give every existing lot its own profile (values copied 1:1, provenance kept),
-- 3) make it required, 4) drop the 12 nutrient columns + nutritionSource + sourceRef.

ALTER TABLE "FeedStock" ADD COLUMN "nutritionProfileId" TEXT;

-- One profile per lot. The new id is parked on the lot first so the profile insert and the link stay 1:1.
UPDATE "FeedStock" SET "nutritionProfileId" = 'nps_' || md5(random()::text || "id");

INSERT INTO "NutritionProfile" (
  "id", "farmId", "dmPct", "cpPct", "meMjPerKgDm", "fatPct", "ndfPct", "adfPct", "rdpPct", "rupPct",
  "starchPct", "calciumPct", "phosphorusPct", "tdnPct", "nutritionSource", "sourceRef", "note", "createdBy", "createdAt"
)
SELECT
  "nutritionProfileId", "farmId", "dmPct", "cpPct", "meMjPerKgDm", "fatPct", "ndfPct", "adfPct", "rdpPct", "rupPct",
  "starchPct", "calciumPct", "phosphorusPct", "tdnPct", "nutritionSource", "sourceRef",
  'Backfilled from the produced-lot nutrient snapshot (RAKHAL-451).', "createdBy", "createdAt"
FROM "FeedStock";

ALTER TABLE "FeedStock" ALTER COLUMN "nutritionProfileId" SET NOT NULL;

ALTER TABLE "FeedStock"
  DROP COLUMN "dmPct", DROP COLUMN "cpPct", DROP COLUMN "meMjPerKgDm", DROP COLUMN "fatPct",
  DROP COLUMN "ndfPct", DROP COLUMN "rdpPct", DROP COLUMN "rupPct", DROP COLUMN "starchPct",
  DROP COLUMN "adfPct", DROP COLUMN "calciumPct", DROP COLUMN "phosphorusPct", DROP COLUMN "tdnPct",
  DROP COLUMN "nutritionSource", DROP COLUMN "sourceRef";

CREATE INDEX "FeedStock_nutritionProfileId_idx" ON "FeedStock"("nutritionProfileId");
ALTER TABLE "FeedStock" ADD CONSTRAINT "FeedStock_nutritionProfileId_fkey"
  FOREIGN KEY ("nutritionProfileId") REFERENCES "NutritionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
