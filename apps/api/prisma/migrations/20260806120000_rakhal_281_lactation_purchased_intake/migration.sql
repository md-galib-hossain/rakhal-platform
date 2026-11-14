-- RAKHAL-281: Lactation purchased/estimated intake + startReason/endReason
-- correctness (breaking rename, user-approved pre-release).

-- 1. Rename LactationStartReason.PURCHASE_IMPORT -> PURCHASED_LACTATING.
-- `RENAME VALUE` renames the enum label in place (Postgres 10+) — every
-- existing `Lactation.startReason='PURCHASE_IMPORT'` row automatically reads
-- as 'PURCHASED_LACTATING' after this statement, so no separate UPDATE
-- backfill is needed (the underlying stored value doesn't change, only its
-- label).
ALTER TYPE "LactationStartReason" RENAME VALUE 'PURCHASE_IMPORT' TO 'PURCHASED_LACTATING';

-- 2. New value: HISTORICAL_IMPORT (paper-record migration into the system,
-- distinct provenance from a live purchased-cow intake).
ALTER TYPE "LactationStartReason" ADD VALUE 'HISTORICAL_IMPORT';

-- 3. New LactationEndReason enum + nullable Lactation.endReason column.
CREATE TYPE "LactationEndReason" AS ENUM ('DRY_OFF', 'SOLD', 'CULLED', 'DEATH', 'MANUAL_CORRECTION', 'MISSING_DRY_OFF_RECORD');

ALTER TABLE "Lactation" ADD COLUMN "endReason" "LactationEndReason";

-- 4. Estimated-intake fields (purchased-lactating cow, no CalvingEvent).
ALTER TABLE "Lactation" ADD COLUMN "isEstimated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lactation" ADD COLUMN "estimatedLactationNumber" INTEGER;
ALTER TABLE "Lactation" ADD COLUMN "estimatedDaysInMilk" INTEGER;
