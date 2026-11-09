"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMilkPrice = computeMilkPrice;
const round2 = (n) => Math.round(n * 100) / 100;
function computeMilkPrice(input) {
    const volume = Math.max(0, input.volumeL);
    const base = round2(volume * input.basePricePerLitre);
    const fatBonus = input.fatPct == null
        ? 0
        : round2(Math.max(0, (input.fatPct - input.baseFatPct) / 0.1) *
            input.fatBonusPer01Pct *
            volume);
    const sccPenalty = input.scc == null
        ? 0
        : round2(Math.max(0, (input.scc - input.sccThreshold) / 100_000) *
            input.sccPenaltyPer100k *
            volume);
    return {
        base,
        pricePerL: input.basePricePerLitre,
        fatBonus,
        sccPenalty,
        total: round2(base + fatBonus - sccPenalty),
    };
}
//# sourceMappingURL=milk-price.js.map