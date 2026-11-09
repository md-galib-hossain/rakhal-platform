"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffective = resolveEffective;
const SOURCE_RANK = {
    REFERENCE: 0,
    FARM_ESTIMATE: 1,
    MANUFACTURER: 2,
    LAB: 3,
};
const pick = (custom, standard) => custom === null || custom === undefined ? standard : custom;
function resolveEffective(ingredient, override) {
    const hasNutritionOverride = Boolean(override &&
        (override.customDmPct !== null ||
            override.customCpPct !== null ||
            override.customMeMjPerKgDm !== null ||
            override.customFatPct !== null ||
            override.customNdfPct !== null ||
            override.customRdpPct !== null ||
            override.customRupPct !== null ||
            override.customStarchPct !== null ||
            override.customAdfPct !== null ||
            override.customCalciumPct !== null ||
            override.customPhosphorusPct !== null ||
            override.customTdnPct !== null));
    const priceOverridden = override?.customPricePerKg !== null &&
        override?.customPricePerKg !== undefined;
    const catalogueSource = ingredient.nutritionSource ?? 'REFERENCE';
    const overrideSource = override?.nutritionSource ?? null;
    const nutritionSource = overrideSource !== null &&
        SOURCE_RANK[overrideSource] > SOURCE_RANK[catalogueSource]
        ? overrideSource
        : catalogueSource;
    return {
        id: ingredient.id,
        pricePerKg: pick(override?.customPricePerKg, ingredient.currentPricePerKg),
        priceSource: priceOverridden ? 'farm_override' : 'rakhal_market',
        hasNutritionOverride,
        dmPct: pick(override?.customDmPct, ingredient.dmPct),
        cpPct: pick(override?.customCpPct, ingredient.cpPct),
        meMjPerKgDm: pick(override?.customMeMjPerKgDm, ingredient.meMjPerKgDm),
        fatPct: pick(override?.customFatPct, ingredient.fatPct ?? 0),
        ndfPct: pick(override?.customNdfPct, ingredient.ndfPct ?? 0),
        rdpPct: pick(override?.customRdpPct, ingredient.rdpPct ?? 0),
        rupPct: pick(override?.customRupPct, ingredient.rupPct ?? 0),
        starchPct: pick(override?.customStarchPct, ingredient.starchPct ?? 0),
        adfPct: pick(override?.customAdfPct, ingredient.adfPct ?? 0),
        calciumPct: pick(override?.customCalciumPct, ingredient.calciumPct ?? 0),
        phosphorusPct: pick(override?.customPhosphorusPct, ingredient.phosphorusPct ?? 0),
        tdnPct: pick(override?.customTdnPct, ingredient.tdnPct ?? 0),
        nutritionSource,
    };
}
//# sourceMappingURL=ingredient-resolver.js.map