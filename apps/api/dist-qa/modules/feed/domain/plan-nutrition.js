"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNutrientSupply = computeNutrientSupply;
exports.buildNutrientRows = buildNutrientRows;
const program_fit_1 = require("./program-fit");
const round2 = (v) => Math.round(v * 100) / 100;
const OTHER_BELOW_PCT = 10;
const OTHER_ABOVE_PCT = 20;
const NO_UPPER_LIMIT_PCT = 1e9;
const OPTIONAL_PCT = {
    fat: 'fatPct',
    ndf: 'ndfPct',
    adf: 'adfPct',
    tdn: 'tdnPct',
    calcium: 'calciumPct',
    phosphorus: 'phosphorusPct',
    starch: 'starchPct',
};
function computeNutrientSupply(lines) {
    const keys = [
        'dm',
        'cp',
        'me',
        'fat',
        'ndf',
        'adf',
        'tdn',
        'calcium',
        'phosphorus',
        'starch',
        'rdp',
        'rup',
    ];
    const out = Object.fromEntries(keys.map((k) => [k, { value: 0, measured: true }]));
    for (const line of lines) {
        if (!(line.kgPerDay > 0))
            continue;
        const p = line.profile;
        if (!p) {
            for (const k of keys)
                out[k].measured = false;
            continue;
        }
        const dmKg = line.kgPerDay * (p.dmPct / 100);
        const cpKg = dmKg * (p.cpPct / 100);
        out.dm.value += dmKg;
        out.cp.value += cpKg;
        out.me.value += dmKg * p.meMjPerKgDm;
        for (const [key, field] of Object.entries(OPTIONAL_PCT)) {
            const pct = p[field];
            if (pct == null)
                out[key].measured = false;
            else
                out[key].value += dmKg * (pct / 100);
        }
        if (p.rdpPct == null)
            out.rdp.measured = false;
        else
            out.rdp.value += cpKg * (p.rdpPct / 100);
        if (p.rupPct == null)
            out.rup.measured = false;
        else
            out.rup.value += cpKg * (p.rupPct / 100);
    }
    return out;
}
function row(key, unit, supply, requirement, measured, below, above, max = null, infoOnly = false) {
    if (supply == null || requirement == null || !(requirement > 0)) {
        const unjudgeable = requirement == null && !infoOnly;
        return {
            key,
            unit,
            supply: supply == null ? null : round2(supply),
            requirement: requirement == null ? null : round2(requirement),
            max,
            delta_pct: null,
            severity: measured && !unjudgeable ? 'ok' : 'unknown',
            measured,
        };
    }
    const fit = (0, program_fit_1.classifyDelta)(supply, requirement, below, above);
    let severity = measured ? fit.severity : 'unknown';
    if (measured && max != null && supply > max && severity === 'ok')
        severity = 'warn';
    return {
        key,
        unit,
        supply: round2(supply),
        requirement: round2(requirement),
        max,
        delta_pct: fit.deltaPct,
        severity,
        measured,
    };
}
function buildNutrientRows(supply, req, bands) {
    const s = supply;
    const cp = s.cp.value;
    const caP = s.phosphorus.value > 0 ? s.calcium.value / s.phosphorus.value : null;
    const pctOfCp = (k) => cp > 0 ? (s[k].value / cp) * 100 : null;
    return [
        row('dm', 'kg', s.dm.value, req.dm_kg, s.dm.measured, bands.dmBelowPct, bands.dmAbovePct),
        row('cp', 'kg', s.cp.value, req.cp_kg, s.cp.measured, bands.cpBelowPct, bands.cpAbovePct),
        row('me', 'MJ', s.me.value, req.me_mj, s.me.measured, bands.meBelowPct, bands.meAbovePct),
        row('fat', 'kg', s.fat.value, req.fat_kg, s.fat.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT),
        row('ndf', 'kg', s.ndf.value, req.ndf_kg, s.ndf.measured, OTHER_BELOW_PCT, NO_UPPER_LIMIT_PCT, req.ndf_max_kg > 0 ? round2(req.ndf_max_kg) : null),
        row('adf', 'kg', s.adf.value, req.adf_kg, s.adf.measured, OTHER_BELOW_PCT, NO_UPPER_LIMIT_PCT),
        row('tdn', 'kg', s.tdn.value, req.tdn_kg, s.tdn.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT),
        row('calcium', 'kg', s.calcium.value, req.calcium_kg, s.calcium.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT),
        row('phosphorus', 'kg', s.phosphorus.value, req.phosphorus_kg, s.phosphorus.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT),
        row('ca_p_ratio', ': 1', caP, req.ca_p_ratio_target, s.calcium.measured && s.phosphorus.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT),
        row('rdp_pct', '% of CP', pctOfCp('rdp'), req.rdp_pct, s.rdp.measured && s.cp.measured, OTHER_BELOW_PCT, OTHER_BELOW_PCT),
        row('rup_pct', '% of CP', pctOfCp('rup'), req.rup_pct, s.rup.measured && s.cp.measured, OTHER_BELOW_PCT, OTHER_BELOW_PCT),
        row('starch', 'kg', s.starch.value, null, s.starch.measured, OTHER_BELOW_PCT, OTHER_ABOVE_PCT, null, true),
    ];
}
//# sourceMappingURL=plan-nutrition.js.map