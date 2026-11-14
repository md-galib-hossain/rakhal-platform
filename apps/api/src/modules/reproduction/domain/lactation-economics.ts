/**
 * Pure lactation-economics calculation helpers (RAKHAL-289). No framework/
 * Prisma imports so they're unit-testable without a Prisma double, mirroring
 * the `lactation-yield.ts`/`lactation-persistency.ts` precedent in this same
 * directory. `LactationEconomicsService` gathers the raw inputs (saleable
 * litres from `LactationStatsService.getStats()`, cost totals from read-only
 * cross-module Prisma queries into Finance/Feed) and hands them to these
 * functions to compute revenue, allocated costs, and margin.
 *
 * Every money figure here is a **simplification** the ticket explicitly
 * accepts: milk revenue uses one effective rate per litre (this codebase
 * doesn't track milk sales per-cow — `MilkDispatch` is tank-level, not
 * cow-level), and feed cost counts only the cow's own individual feed
 * distributions. Both simplifications are documented on the returned object
 * via `assumptions` fields, not hidden.
 */

/** Milk revenue = saleable litres × the effective per-litre rate. */
export function computeMilkRevenue(
  saleableLitres: number,
  ratePerLitre: number,
): number {
  return round(saleableLitres * ratePerLitre);
}

/**
 * Discarded/withheld milk valued as a **cost**, not negative revenue — per
 * the ticket's explicit AC ("discarded/withheld milk value (as a cost, not
 * revenue)"). Uses the same effective rate as `computeMilkRevenue` so the
 * two never disagree about what a litre is worth.
 */
export function computeDiscardedWithheldValue(
  withheldLitres: number,
  discardedLitres: number,
  ratePerLitre: number,
): number {
  return round((withheldLitres + discardedLitres) * ratePerLitre);
}

export interface LactationFinancialInputs {
  milkRevenue: number;
  feedCost: number;
  medicineCost: number;
  breedingCost: number;
  discardedWithheldValue: number;
}

export interface LactationFinancialTotals extends LactationFinancialInputs {
  totalCost: number;
  margin: number;
}

/**
 * Total allocated cost + margin. `totalCost` sums every cost bucket
 * (including `discardedWithheldValue`, per the ticket's "minus" framing);
 * `margin` is `milkRevenue - totalCost` and may be negative.
 */
export function computeLactationMargin(
  inputs: LactationFinancialInputs,
): LactationFinancialTotals {
  const totalCost = round(
    inputs.feedCost +
      inputs.medicineCost +
      inputs.breedingCost +
      inputs.discardedWithheldValue,
  );
  return {
    ...inputs,
    totalCost,
    margin: round(inputs.milkRevenue - totalCost),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
