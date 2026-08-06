-- RAKHAL-284: `Lactation.peakMilkYield`/`peakDaysInMilk` (highest single
-- "complete"-quality day's yield recorded so far this lactation, plus that
-- day's DIM). `peakMilkDate` already existed on this model — reused, not
-- duplicated. Purely additive, both nullable (no complete day recorded yet
-- for a brand-new lactation) — recomputed by `MilkService.saveLog()` on
-- each saleable-affecting milk-log write, never backfilled/guessed here.
--
-- Hand-authored (mirrors the `rakhal_278_milk_colostrum_window_days`/
-- `rakhal_280_animal_hold` migrations' style) because `prisma migrate dev`
-- refused to run non-interactively — an unrelated pending warning from a
-- sibling in-flight agent's `SafetyWithdrawalStatus` enum-value removal
-- blocked the interactive prompt, same class of blocker RAKHAL-282's own
-- migration hit.

ALTER TABLE "Lactation" ADD COLUMN "peakMilkYield" DOUBLE PRECISION;
ALTER TABLE "Lactation" ADD COLUMN "peakDaysInMilk" INTEGER;
