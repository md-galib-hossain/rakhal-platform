/**
 * Milk price calculation (PRD §11.4). Pure, framework-free, unit-tested.
 *
 * final = base price × litres
 *       + fat bonus:   (fat% − base fat%) / 0.1 × bonus rate × litres   (≥ 0)
 *       − SCC penalty: (SCC − threshold) / 100,000 × penalty rate × litres (≥ 0)
 */

export interface MilkPriceInput {
  volumeL: number;
  basePricePerLitre: number;
  fatPct?: number | null;
  baseFatPct: number;
  fatBonusPer01Pct: number;
  scc?: number | null;
  sccThreshold: number;
  sccPenaltyPer100k: number;
}

export interface MilkPriceBreakdown {
  base: number;
  pricePerL: number;
  fatBonus: number;
  sccPenalty: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeMilkPrice(input: MilkPriceInput): MilkPriceBreakdown {
  const volume = Math.max(0, input.volumeL);
  const base = round2(volume * input.basePricePerLitre);

  const fatBonus =
    input.fatPct == null
      ? 0
      : round2(
          Math.max(0, (input.fatPct - input.baseFatPct) / 0.1) *
            input.fatBonusPer01Pct *
            volume,
        );

  const sccPenalty =
    input.scc == null
      ? 0
      : round2(
          Math.max(0, (input.scc - input.sccThreshold) / 100_000) *
            input.sccPenaltyPer100k *
            volume,
        );

  return {
    base,
    pricePerL: input.basePricePerLitre,
    fatBonus,
    sccPenalty,
    total: round2(base + fatBonus - sccPenalty),
  };
}
