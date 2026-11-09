"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTotals = computeTotals;
exports.balanceScore = balanceScore;
exports.normalize = normalize;
const round = (v) => Math.round(v * 100) / 100;
const emptyTotals = () => ({
    dm_kg: 0,
    cp_kg: 0,
    me_mj: 0,
    ndf_kg: 0,
    fat_kg: 0,
    rdp_kg: 0,
    rup_kg: 0,
    starch_kg: 0,
    adf_kg: 0,
    calcium_kg: 0,
    phosphorus_kg: 0,
    tdn_kg: 0,
    total_cost_tk: 0,
});
function computeTotals(lines, effectiveById) {
    const items = [];
    const totals = emptyTotals();
    for (const line of lines) {
        const eff = effectiveById.get(line.ingredientId);
        if (!eff)
            continue;
        const dm = line.amountKg * (eff.dmPct / 100);
        const cpKg = dm * (eff.cpPct / 100);
        const item = {
            ingredientId: line.ingredientId,
            amount_kg: round(line.amountKg),
            dm_kg: round(dm),
            cp_kg: round(cpKg),
            me_mj: round(dm * eff.meMjPerKgDm),
            ndf_kg: round(dm * (eff.ndfPct / 100)),
            fat_kg: round(dm * (eff.fatPct / 100)),
            rdp_kg: round(cpKg * (eff.rdpPct / 100)),
            rup_kg: round(cpKg * (eff.rupPct / 100)),
            starch_kg: round(dm * (eff.starchPct / 100)),
            adf_kg: round(dm * (eff.adfPct / 100)),
            calcium_kg: round(dm * (eff.calciumPct / 100)),
            phosphorus_kg: round(dm * (eff.phosphorusPct / 100)),
            tdn_kg: round(dm * (eff.tdnPct / 100)),
            cost_tk: round(line.amountKg * eff.pricePerKg),
        };
        items.push(item);
        totals.dm_kg += item.dm_kg;
        totals.cp_kg += item.cp_kg;
        totals.me_mj += item.me_mj;
        totals.ndf_kg += item.ndf_kg;
        totals.fat_kg += item.fat_kg;
        totals.rdp_kg += item.rdp_kg;
        totals.rup_kg += item.rup_kg;
        totals.starch_kg += item.starch_kg;
        totals.adf_kg += item.adf_kg;
        totals.calcium_kg += item.calcium_kg;
        totals.phosphorus_kg += item.phosphorus_kg;
        totals.tdn_kg += item.tdn_kg;
        totals.total_cost_tk += item.cost_tk;
    }
    return {
        items,
        totals: {
            dm_kg: round(totals.dm_kg),
            cp_kg: round(totals.cp_kg),
            me_mj: round(totals.me_mj),
            ndf_kg: round(totals.ndf_kg),
            fat_kg: round(totals.fat_kg),
            rdp_kg: round(totals.rdp_kg),
            rup_kg: round(totals.rup_kg),
            starch_kg: round(totals.starch_kg),
            adf_kg: round(totals.adf_kg),
            calcium_kg: round(totals.calcium_kg),
            phosphorus_kg: round(totals.phosphorus_kg),
            tdn_kg: round(totals.tdn_kg),
            total_cost_tk: round(totals.total_cost_tk),
        },
    };
}
function balanceScore(totals, req) {
    const ratios = [
        req.dmKg > 0 ? totals.dm_kg / req.dmKg : 1,
        req.cpKg > 0 ? totals.cp_kg / req.cpKg : 1,
        req.meMj > 0 ? totals.me_mj / req.meMj : 1,
    ].map((r) => Math.min(r, 1));
    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return Math.round(mean * 100);
}
function normalize(lines, req, effectiveById) {
    const { totals } = computeTotals(lines, effectiveById);
    if (totals.dm_kg <= 0 || req.dmKg <= 0) {
        return lines.map((l) => ({ ...l, amountKg: round(l.amountKg) }));
    }
    const factor = req.dmKg / totals.dm_kg;
    return lines.map((l) => ({
        ingredientId: l.ingredientId,
        amountKg: round(l.amountKg * factor),
    }));
}
//# sourceMappingURL=formula-math.js.map