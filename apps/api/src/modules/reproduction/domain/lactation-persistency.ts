/**
 * Pure lactation persistency calculation (RAKHAL-284). No framework/Prisma
 * imports so it's unit-testable without a Prisma double, mirroring the
 * `lactation-yield.ts`/`lactation-curve.ts` precedent in this same directory.
 *
 * Persistency is a *transparent* formula per the ticket's explicit ask ("no
 * unexplained proprietary score, shown with its inputs") — not a fitted
 * lactation-curve model or a farm-specific coefficient. It compares the
 * cow's current rolling 7-day average yield against her recorded peak, and
 * reports the decline as a plain percentage alongside every input that went
 * into it, so a farmer (or a future report) can see exactly how the number
 * was derived rather than trusting an opaque score.
 */

export interface LactationPersistency {
  /** Current rolling 7-day average daily yield (L) — same figure `LactationStatsService.getStats()` already returns as `sevenDayAvgYield`. */
  currentSevenDayAvgYield: number;
  /** The stored `Lactation.peakMilkYield` (L) this comparison is measured against. */
  peakMilkYield: number;
  /** The stored `Lactation.peakDaysInMilk` the peak occurred at. */
  peakDaysInMilk: number;
  /** Days elapsed between the peak day and the current reference day (never negative — clamped to 0 if the reference date is at or before the peak). */
  daysSincePeak: number;
  /** `currentSevenDayAvgYield / peakMilkYield * 100`, rounded to 2dp. 100 = still at peak, below 100 = declined, above 100 = currently exceeding the recorded peak (e.g. a stale/low peak that hasn't been recomputed on a big day yet). */
  persistencyPct: number;
  /** `100 - persistencyPct`, rounded to 2dp. The plain "% decline from peak" figure the ticket asks for. */
  declinePct: number;
}

/**
 * Returns `null` when there is no recorded peak yet (`peakMilkYield`/
 * `peakDaysInMilk` both null — a brand-new lactation with no `complete` day
 * on record) or the peak is non-positive (division-by-zero guard; should
 * never happen in practice since `computeLactationPeak` only ever returns a
 * `yieldL > 0` day, but a `0`-litre stored value is treated the same as
 * "no meaningful peak to compare against" rather than producing `Infinity`).
 */
export function computeLactationPersistency(params: {
  currentSevenDayAvgYield: number;
  peakMilkYield: number | null;
  peakDaysInMilk: number | null;
  currentDaysInMilk: number;
}): LactationPersistency | null {
  const {
    currentSevenDayAvgYield,
    peakMilkYield,
    peakDaysInMilk,
    currentDaysInMilk,
  } = params;

  if (peakMilkYield == null || peakDaysInMilk == null || peakMilkYield <= 0) {
    return null;
  }

  const daysSincePeak = Math.max(0, currentDaysInMilk - peakDaysInMilk);
  const persistencyPct = round((currentSevenDayAvgYield / peakMilkYield) * 100);

  return {
    currentSevenDayAvgYield,
    peakMilkYield,
    peakDaysInMilk,
    daysSincePeak,
    persistencyPct,
    declinePct: round(100 - persistencyPct),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
