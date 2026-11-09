"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMilkRevenue = computeMilkRevenue;
exports.computeDiscardedWithheldValue = computeDiscardedWithheldValue;
exports.computeLactationMargin = computeLactationMargin;
function computeMilkRevenue(saleableLitres, ratePerLitre) {
    return round(saleableLitres * ratePerLitre);
}
function computeDiscardedWithheldValue(withheldLitres, discardedLitres, ratePerLitre) {
    return round((withheldLitres + discardedLitres) * ratePerLitre);
}
function computeLactationMargin(inputs) {
    const totalCost = round(inputs.feedCost +
        inputs.medicineCost +
        inputs.breedingCost +
        inputs.discardedWithheldValue);
    return {
        ...inputs,
        totalCost,
        margin: round(inputs.milkRevenue - totalCost),
    };
}
function round(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=lactation-economics.js.map