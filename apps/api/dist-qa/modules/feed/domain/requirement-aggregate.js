"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateRequirements = aggregateRequirements;
const round = (v) => Math.round(v * 100) / 100;
const sumBreakdown = (rows) => {
    const add = (k) => {
        const out = {};
        for (const r of rows)
            for (const [f, v] of Object.entries(r[k]))
                out[f] = (out[f] ?? 0) + v;
        return out;
    };
    return { dm: add('dm'), me: add('me'), cp: add('cp') };
};
const scaleBreakdown = (b, divisor) => {
    const div = (k) => Object.fromEntries(Object.entries(b[k]).map(([f, v]) => [f, round(v / divisor)]));
    return { dm: div('dm'), me: div('me'), cp: div('cp') };
};
function aggregateRequirements(reqs) {
    const n = reqs.length;
    const sum = (pick) => reqs.reduce((a, r) => a + pick(r), 0);
    const withCa = reqs.filter((r) => r.calciumKg != null);
    const withP = reqs.filter((r) => r.phosphorusKg != null);
    const withBreakdown = reqs.filter((r) => r.breakdown != null);
    const first = reqs[0];
    const build = (divisor, caDiv, pDiv, bDiv) => {
        const dmKg = sum((r) => r.dmKg) / divisor;
        const cpKg = sum((r) => r.cpKg) / divisor;
        const meMj = sum((r) => r.meMj) / divisor;
        return {
            dmKg: round(dmKg),
            cpKg: round(cpKg),
            meMj: round(meMj),
            ndfKg: round(sum((r) => r.ndfKg) / divisor),
            fatKg: round(sum((r) => r.fatKg) / divisor),
            neMcal: round(sum((r) => r.neMcal) / divisor),
            energyDensityMjPerKgDm: round(dmKg > 0 ? meMj / dmKg : 0),
            cpPctOfDm: round(dmKg > 0 ? (cpKg / dmKg) * 100 : 0),
            tdnKg: round(sum((r) => r.tdnKg) / divisor),
            calciumKg: withCa.length > 0
                ? round(withCa.reduce((a, r) => a + (r.calciumKg ?? 0), 0) / caDiv)
                : null,
            phosphorusKg: withP.length > 0
                ? round(withP.reduce((a, r) => a + (r.phosphorusKg ?? 0), 0) / pDiv)
                : null,
            adfKg: round(sum((r) => r.adfKg) / divisor),
            rdpPct: first.rdpPct,
            rupPct: first.rupPct,
            ndfMaxKg: round(sum((r) => r.ndfMaxKg) / divisor),
            caPRatioTarget: first.caPRatioTarget,
            breakdown: withBreakdown.length > 0
                ? scaleBreakdown(sumBreakdown(withBreakdown.map((r) => r.breakdown)), bDiv)
                : null,
        };
    };
    return {
        total: build(1, 1, 1, 1),
        mean: build(n, withCa.length, withP.length, withBreakdown.length),
        caPHeadcount: withCa.length,
    };
}
//# sourceMappingURL=requirement-aggregate.js.map