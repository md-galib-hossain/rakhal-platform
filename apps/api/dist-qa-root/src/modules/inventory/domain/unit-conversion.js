"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitsCompatible = unitsCompatible;
exports.convertQuantity = convertQuantity;
function unitsCompatible(from, to) {
    if (from.id === to.id)
        return true;
    if (from.dimension !== to.dimension)
        return false;
    if (from.dimension === 'COUNT')
        return false;
    return (typeof from.conversionToBase === 'number' &&
        from.conversionToBase > 0 &&
        typeof to.conversionToBase === 'number' &&
        to.conversionToBase > 0);
}
function convertQuantity(quantity, from, to) {
    if (from.id === to.id)
        return quantity;
    if (!unitsCompatible(from, to)) {
        throw new Error(`Cannot convert ${from.symbol ?? from.id} (${from.dimension}) to ${to.symbol ?? to.id} (${to.dimension})`);
    }
    const converted = (quantity * from.conversionToBase) / to.conversionToBase;
    return Math.round(converted * 1e9) / 1e9;
}
//# sourceMappingURL=unit-conversion.js.map