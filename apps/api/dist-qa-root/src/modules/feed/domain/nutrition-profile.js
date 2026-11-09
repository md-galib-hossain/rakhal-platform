"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moisturePctFromDm = exports.ME_MAX_MJ_PER_KG_DM = exports.NUTRIENT_KEYS = exports.OPTIONAL_NUTRIENT_KEYS = exports.CORE_NUTRIENT_KEYS = void 0;
exports.toNutritionValues = toNutritionValues;
exports.validateNutrition = validateNutrition;
exports.mergeCatalogueNutrition = mergeCatalogueNutrition;
exports.blendNutrition = blendNutrition;
exports.diffNutrition = diffNutrition;
exports.CORE_NUTRIENT_KEYS = ['dmPct', 'cpPct', 'meMjPerKgDm'];
exports.OPTIONAL_NUTRIENT_KEYS = [
    'fatPct',
    'ndfPct',
    'adfPct',
    'rdpPct',
    'rupPct',
    'starchPct',
    'sugarsPct',
    'calciumPct',
    'phosphorusPct',
    'tdnPct',
];
exports.NUTRIENT_KEYS = [
    ...exports.CORE_NUTRIENT_KEYS,
    ...exports.OPTIONAL_NUTRIENT_KEYS,
];
exports.ME_MAX_MJ_PER_KG_DM = 40;
const SUM_TOLERANCE = 5;
function toNutritionValues(input) {
    const out = {};
    for (const key of exports.CORE_NUTRIENT_KEYS)
        out[key] = input[key];
    for (const key of exports.OPTIONAL_NUTRIENT_KEYS)
        out[key] = input[key] ?? null;
    return out;
}
function validateNutrition(v) {
    const problems = [];
    for (const key of exports.NUTRIENT_KEYS) {
        const value = v[key];
        if (value === null)
            continue;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            problems.push(`${key} must be a number`);
        }
    }
    if (problems.length > 0)
        return problems;
    if (v.dmPct <= 0 || v.dmPct > 100) {
        problems.push('dmPct must be greater than 0 and at most 100');
    }
    if (v.cpPct < 0 || v.cpPct > 100)
        problems.push('cpPct must be between 0 and 100');
    if (v.meMjPerKgDm < 0 || v.meMjPerKgDm > exports.ME_MAX_MJ_PER_KG_DM) {
        problems.push(`meMjPerKgDm must be between 0 and ${exports.ME_MAX_MJ_PER_KG_DM} MJ/kg DM`);
    }
    for (const key of exports.OPTIONAL_NUTRIENT_KEYS) {
        const value = v[key];
        if (value !== null && (value < 0 || value > 100)) {
            problems.push(`${key} must be between 0 and 100`);
        }
    }
    if (v.ndfPct !== null && v.adfPct !== null && v.ndfPct < v.adfPct) {
        problems.push('ndfPct must be at least adfPct (ADF is a subset of NDF)');
    }
    if (v.rdpPct !== null && v.rupPct !== null && v.rdpPct + v.rupPct > 100 + 1) {
        problems.push('rdpPct + rupPct cannot exceed 100 (both are % of CP)');
    }
    if (v.calciumPct !== null &&
        v.phosphorusPct !== null &&
        v.calciumPct + v.phosphorusPct > 100) {
        problems.push('calciumPct + phosphorusPct cannot exceed 100');
    }
    const measured = v.cpPct + (v.fatPct ?? 0) + (v.ndfPct ?? 0) + (v.starchPct ?? 0);
    if (measured > 100 + SUM_TOLERANCE) {
        problems.push('cpPct + fatPct + ndfPct + starchPct cannot exceed 100% of dry matter');
    }
    return problems;
}
function mergeCatalogueNutrition(ingredient, override) {
    const pick = (custom, standard) => custom ?? standard ?? null;
    return {
        dmPct: pick(override?.customDmPct, ingredient.dmPct),
        cpPct: pick(override?.customCpPct, ingredient.cpPct),
        meMjPerKgDm: pick(override?.customMeMjPerKgDm, ingredient.meMjPerKgDm),
        fatPct: pick(override?.customFatPct, ingredient.fatPct),
        ndfPct: pick(override?.customNdfPct, ingredient.ndfPct),
        adfPct: pick(override?.customAdfPct, ingredient.adfPct),
        rdpPct: pick(override?.customRdpPct, ingredient.rdpPct),
        rupPct: pick(override?.customRupPct, ingredient.rupPct),
        starchPct: pick(override?.customStarchPct, ingredient.starchPct),
        sugarsPct: ingredient.sugarsPct ?? null,
        calciumPct: pick(override?.customCalciumPct, ingredient.calciumPct),
        phosphorusPct: pick(override?.customPhosphorusPct, ingredient.phosphorusPct),
        tdnPct: pick(override?.customTdnPct, ingredient.tdnPct),
    };
}
const moisturePctFromDm = (dmPct) => Math.round((100 - dmPct) * 100) / 100;
exports.moisturePctFromDm = moisturePctFromDm;
function blendNutrition(parts) {
    const live = parts.filter((p) => p.kg > 0);
    if (live.length === 0) {
        throw new Error('blendNutrition needs at least one part');
    }
    if (live.length === 1)
        return { ...live[0].values };
    const dmKg = (p) => p.kg * (p.values.dmPct / 100);
    const cpKg = (p) => dmKg(p) * (p.values.cpPct / 100);
    const weighted = (key, weight) => {
        let num = 0;
        let den = 0;
        for (const p of live) {
            const v = p.values[key];
            if (v === null)
                return null;
            num += v * weight(p);
            den += weight(p);
        }
        return den > 0 ? num / den : null;
    };
    const out = {};
    for (const key of exports.NUTRIENT_KEYS) {
        const weight = key === 'dmPct'
            ? (p) => p.kg
            : key === 'rdpPct' || key === 'rupPct'
                ? cpKg
                : dmKg;
        const v = weighted(key, weight);
        out[key] = v === null ? null : Math.round(v * 1e4) / 1e4;
    }
    return out;
}
function diffNutrition(a, b, epsilon = 1e-9) {
    return exports.NUTRIENT_KEYS.filter((key) => {
        const x = a[key];
        const y = b[key];
        if (x === null || y === null)
            return x !== y;
        return Math.abs(x - y) > epsilon;
    });
}
//# sourceMappingURL=nutrition-profile.js.map