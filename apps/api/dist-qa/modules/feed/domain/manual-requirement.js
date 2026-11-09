"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirementsFromManual = requirementsFromManual;
exports.validateManualValues = validateManualValues;
exports.isManualStale = isManualStale;
const requirements_1 = require("./requirements");
const round = (v) => Math.round(v * 100) / 100;
const stored = (v) => v === null || v === undefined ? null : round(v);
function requirementsFromManual(manual, settings) {
    const { dmKg, cpKg, meMj } = manual;
    const calciumKg = stored(manual.calciumKg);
    const phosphorusKg = stored(manual.phosphorusKg);
    return {
        dmKg: round(dmKg),
        cpKg: round(cpKg),
        meMj: round(meMj),
        ndfKg: stored(manual.ndfKg) ?? round(settings.ndfMinShareOfIntake * dmKg),
        ndfMaxKg: stored(manual.ndfMaxKg) ?? round(settings.ndfMaxShareOfIntake * dmKg),
        fatKg: stored(manual.fatKg) ?? round(settings.fatShareOfIntake * dmKg),
        adfKg: stored(manual.adfKg) ?? round(settings.adfShareOfIntake * dmKg),
        tdnKg: stored(manual.tdnKg) ?? round(settings.tdnShareOfIntake * dmKg),
        cpPctOfDm: round(dmKg > 0 ? (cpKg / dmKg) * 100 : 0),
        energyDensityMjPerKgDm: round(dmKg > 0 ? meMj / dmKg : 0),
        neMcal: round((meMj / requirements_1.MJ_PER_MCAL) * settings.netEnergyEfficiency),
        calciumKg,
        phosphorusKg,
        rdpPct: stored(manual.rdpPct) ?? settings.degradableProteinShare,
        rupPct: stored(manual.rupPct) ?? settings.undegradableProteinShare,
        caPRatioTarget: calciumKg !== null && phosphorusKg !== null && phosphorusKg > 0
            ? round(calciumKg / phosphorusKg)
            : settings.calciumToPhosphorusTarget,
        breakdown: null,
    };
}
function validateManualValues(v, weightKg) {
    const errors = [];
    const warnings = [];
    const err = (field, code, message) => errors.push({ field, code, message });
    const warn = (field, code, message) => warnings.push({ field, code, message });
    const has = (n) => n !== null && n !== undefined;
    const { dmKg, cpKg, meMj } = v;
    if (!(dmKg >= 0.5 && dmKg <= 40))
        err('dmKg', 'dm_range', 'Dry matter must be between 0.5 and 40 kg.');
    if (!(cpKg > 0))
        err('cpKg', 'cp_positive', 'Protein must be above 0.');
    else if (cpKg >= dmKg)
        err('cpKg', 'cp_below_dm', 'Protein must be less than dry matter.');
    if (!(meMj >= 5 && meMj <= 400))
        err('meMj', 'me_range', 'Energy must be between 5 and 400 MJ.');
    const mass = [
        ['ndfKg', 'NDF'],
        ['ndfMaxKg', 'NDF maximum'],
        ['adfKg', 'ADF'],
        ['fatKg', 'Fat'],
        ['tdnKg', 'TDN'],
    ];
    for (const [field, label] of mass) {
        const n = v[field];
        if (!has(n))
            continue;
        if (!(n > 0))
            err(field, 'positive', `${label} must be above 0.`);
        else if (dmKg > 0 && n >= dmKg)
            err(field, 'below_dm', `${label} must be less than dry matter.`);
    }
    for (const [field, label] of [
        ['calciumKg', 'Calcium'],
        ['phosphorusKg', 'Phosphorus'],
    ]) {
        const n = v[field];
        if (has(n) && !(n >= 0))
            err(field, 'non_negative', `${label} cannot be negative.`);
    }
    if (has(v.calciumKg) &&
        has(v.phosphorusKg) &&
        v.calciumKg + v.phosphorusKg >= dmKg)
        err('calciumKg', 'minerals_below_dm', 'Calcium and phosphorus together must be less than dry matter.');
    if (has(v.ndfKg) && has(v.ndfMaxKg) && v.ndfMaxKg < v.ndfKg)
        err('ndfMaxKg', 'ndf_max_below_min', 'NDF maximum must not be below NDF.');
    for (const [field, label] of [
        ['rdpPct', 'RDP'],
        ['rupPct', 'RUP'],
    ]) {
        const n = v[field];
        if (has(n) && !(n >= 0 && n <= 100))
            err(field, 'pct_range', `${label} must be between 0 and 100 %.`);
    }
    if (has(weightKg) && weightKg > 0 && dmKg > 0) {
        const pct = (dmKg / weightKg) * 100;
        if (pct < 1.5 || pct > 4.5)
            warn('dmKg', 'dm_body_weight', `Dry matter is ${pct.toFixed(1)} % of body weight; cows usually eat 1.5–4.5 %.`);
    }
    if (dmKg > 0 && cpKg > 0) {
        const cpPct = (cpKg / dmKg) * 100;
        if (cpPct < 8 || cpPct > 22)
            warn('cpKg', 'cp_share', `Crude protein is ${cpPct.toFixed(1)} % of dry matter; a diet is usually 8–22 %.`);
        const density = meMj / dmKg;
        if (density < 7 || density > 13)
            warn('meMj', 'energy_density', `Energy is ${density.toFixed(1)} MJ per kg of dry matter; a diet is usually 7–13.`);
    }
    const share = (field, code, label, lo, hi) => {
        const n = v[field];
        if (!has(n) || !(n > 0) || !(dmKg > 0))
            return;
        const pct = (n / dmKg) * 100;
        if (pct < lo || pct > hi)
            warn(field, code, `${label} is ${pct.toFixed(1)} % of dry matter; a diet is usually ${lo}–${hi} %.`);
    };
    share('ndfKg', 'ndf_share', 'NDF', 20, 55);
    share('adfKg', 'adf_share', 'ADF', 15, 35);
    share('fatKg', 'fat_share', 'Fat', 1, 8);
    share('tdnKg', 'tdn_share', 'TDN', 50, 80);
    if (has(v.calciumKg) && has(v.phosphorusKg) && v.phosphorusKg > 0) {
        const ratio = v.calciumKg / v.phosphorusKg;
        if (ratio < 1 || ratio > 3)
            warn('calciumKg', 'ca_p_ratio', `Calcium to phosphorus is ${ratio.toFixed(1)} : 1; usually 1–3 : 1.`);
    }
    if (has(v.rdpPct) &&
        has(v.rupPct) &&
        Math.abs(v.rdpPct + v.rupPct - 100) > 0.5)
        warn('rdpPct', 'protein_split', 'RDP and RUP should add up to 100 %.');
    return { errors, warnings };
}
function driftPct(then, now) {
    if (then > 0)
        return round((Math.abs(now - then) / then) * 100);
    return now > 0 ? 100 : 0;
}
function isManualStale(snapshot, dynamicNow, animalTypeNow, driftPctLimit) {
    const drift = {
        dm_pct: driftPct(snapshot.dm_kg, dynamicNow.dmKg),
        cp_pct: driftPct(snapshot.cp_kg, dynamicNow.cpKg),
        me_pct: driftPct(snapshot.me_mj, dynamicNow.meMj),
    };
    const animalTypeChanged = snapshot.animal_type !== animalTypeNow;
    const stale = animalTypeChanged ||
        drift.dm_pct > driftPctLimit ||
        drift.cp_pct > driftPctLimit ||
        drift.me_pct > driftPctLimit;
    return { stale, drift, animal_type_changed: animalTypeChanged };
}
//# sourceMappingURL=manual-requirement.js.map