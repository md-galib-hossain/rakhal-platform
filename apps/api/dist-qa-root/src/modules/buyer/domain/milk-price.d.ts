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
export declare function computeMilkPrice(input: MilkPriceInput): MilkPriceBreakdown;
