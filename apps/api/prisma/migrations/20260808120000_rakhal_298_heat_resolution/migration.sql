-- RAKHAL-298: Heat resolution — AI closes the open heat.
-- Purely additive: new enum, three nullable columns, two indexes, one FK.
-- Deliberately excludes the unrelated pending `SafetyWithdrawalStatus` enum
-- drift seen in `prisma migrate diff` output — that belongs to a different,
-- uncommitted change and is out of this ticket's lane.

-- CreateEnum
CREATE TYPE "HeatResolutionReason" AS ENUM ('INSEMINATED', 'FALSE_ALARM', 'SKIPPED_CYCLE');

-- AlterTable
ALTER TABLE "HeatEvent" ADD COLUMN     "resolutionReason" "HeatResolutionReason",
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByBreedingEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HeatEvent_resolvedByBreedingEventId_key" ON "HeatEvent"("resolvedByBreedingEventId");

-- CreateIndex
CREATE INDEX "HeatEvent_cattleId_resolvedAt_idx" ON "HeatEvent"("cattleId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "HeatEvent" ADD CONSTRAINT "HeatEvent_resolvedByBreedingEventId_fkey" FOREIGN KEY ("resolvedByBreedingEventId") REFERENCES "BreedingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: stamp historical heats followed by a breeding event within 5 days
-- as INSEMINATED. No other value is guessed (RAKHAL-271's "never CASE-guess
-- on ADD COLUMN" lesson) — FALSE_ALARM/SKIPPED_CYCLE are user judgment calls
-- with no reliable historical signal, so unmatched heats stay unresolved.
WITH matches AS (
  SELECT DISTINCT ON (b.id)
    b.id AS breeding_id,
    h.id AS heat_id,
    b."breedingDate" AS breeding_date
  FROM "BreedingEvent" b
  JOIN "HeatEvent" h
    ON h."cattleId" = b."cattleId"
   AND h."heatDateTime" <= b."breedingDate"
   AND b."breedingDate" <= h."heatDateTime" + INTERVAL '5 days'
   AND h."resolvedAt" IS NULL
  ORDER BY b.id, h."heatDateTime" DESC
),
ranked AS (
  SELECT DISTINCT ON (heat_id)
    breeding_id, heat_id, breeding_date
  FROM matches
  ORDER BY heat_id, breeding_date ASC
)
UPDATE "HeatEvent" h
SET "resolvedAt" = r.breeding_date,
    "resolvedByBreedingEventId" = r.breeding_id,
    "resolutionReason" = 'INSEMINATED'
FROM ranked r
WHERE h.id = r.heat_id;
