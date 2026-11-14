-- RAKHAL-366 — MilkDispatch identity + lifecycle (MILESTONE 22,
-- `docs/BUSINESS_IA_PRD.md` §5.8). Hand-authored (`prisma migrate dev`/
-- `diff` both refuse non-interactively in this environment, same precedent
-- as every prior migration on this board).
--
-- Adds `dispatchNumber` (DSP-NNNNNN, unique per farm), `driverName`,
-- `cancelledAt`. Existing rows get a real, gapless dispatch number backfilled
-- in dispatch order (`dispatchedAt`, then `id` as tiebreak) — this also
-- seeds `FarmCounter` (scope `dispatch:<farmId>`) so the app's own
-- `DispatchNumberAllocator` continues the same sequence with no gap or
-- collision on the very next dispatch.

-- Step 1: add nullable columns first — a NOT NULL dispatchNumber cannot be
-- added to a table with existing rows in one statement.
ALTER TABLE "MilkDispatch" ADD COLUMN "dispatchNumber" TEXT;
ALTER TABLE "MilkDispatch" ADD COLUMN "driverName" TEXT;
ALTER TABLE "MilkDispatch" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Step 2: backfill dispatchNumber per farm, ordered by dispatchedAt then id
-- (real chronological dispatch order, not row-creation order).
WITH numbered AS (
  SELECT id,
         'DSP-' || LPAD(
           ROW_NUMBER() OVER (PARTITION BY "farmId" ORDER BY "dispatchedAt", id)::TEXT,
           6, '0'
         ) AS dispatch_number
  FROM "MilkDispatch"
)
UPDATE "MilkDispatch" d
   SET "dispatchNumber" = n.dispatch_number
  FROM numbered n
 WHERE d.id = n.id;

-- Step 3: seed FarmCounter so DispatchNumberAllocator's next `upsert`
-- continues from the highest backfilled value per farm, not from 1.
INSERT INTO "FarmCounter" (scope, value, "updatedAt")
SELECT 'dispatch:' || "farmId", COUNT(*), now()
  FROM "MilkDispatch"
 GROUP BY "farmId"
ON CONFLICT (scope) DO UPDATE
  SET value = GREATEST("FarmCounter".value, EXCLUDED.value);

-- Step 4: constrain now that every row has a value.
ALTER TABLE "MilkDispatch" ALTER COLUMN "dispatchNumber" SET NOT NULL;
ALTER TABLE "MilkDispatch" ADD CONSTRAINT "MilkDispatch_farmId_dispatchNumber_key"
  UNIQUE ("farmId", "dispatchNumber");
