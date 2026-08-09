-- RAKHAL-316: Return-to-heat — farmer-confirmed return to heat before a
-- pregnancy check was due. Purely additive: one enum value, one nullable
-- column, one index, one FK. No backfill — no return-to-heat event existed
-- before this endpoint did, so there is no historical data to derive.

-- AlterEnum
ALTER TYPE "BreedingStatus" ADD VALUE 'RETURNED_TO_HEAT';

-- AlterTable
ALTER TABLE "HeatEvent" ADD COLUMN "returnedFromBreedingEventId" TEXT;

-- CreateIndex
CREATE INDEX "HeatEvent_returnedFromBreedingEventId_idx" ON "HeatEvent"("returnedFromBreedingEventId");

-- AddForeignKey
ALTER TABLE "HeatEvent" ADD CONSTRAINT "HeatEvent_returnedFromBreedingEventId_fkey" FOREIGN KEY ("returnedFromBreedingEventId") REFERENCES "BreedingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
