-- Drop purpose column from Cattle table and drop CattlePurpose enum type
ALTER TABLE "Cattle" DROP COLUMN IF EXISTS "purpose";

DROP TYPE IF EXISTS "CattlePurpose";
