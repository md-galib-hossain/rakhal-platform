"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PURCHASE_NUMBER_PREFIX = void 0;
exports.purchaseCounterScope = purchaseCounterScope;
exports.formatPurchaseNumber = formatPurchaseNumber;
exports.PURCHASE_NUMBER_PREFIX = 'PUR';
function purchaseCounterScope(farmId) {
    return `purchase:${farmId}`;
}
function formatPurchaseNumber(value) {
    return `${exports.PURCHASE_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
//# sourceMappingURL=purchase-number.js.map