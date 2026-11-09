"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALE_NUMBER_PREFIX = void 0;
exports.saleCounterScope = saleCounterScope;
exports.formatSaleNumber = formatSaleNumber;
exports.SALE_NUMBER_PREFIX = 'INV';
function saleCounterScope(farmId) {
    return `sale:${farmId}`;
}
function formatSaleNumber(value) {
    return `${exports.SALE_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
//# sourceMappingURL=sale-number.js.map