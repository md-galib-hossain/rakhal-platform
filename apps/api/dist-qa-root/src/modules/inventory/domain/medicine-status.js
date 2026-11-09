"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPIRY_SOON_DAYS = void 0;
exports.computeStockStatus = computeStockStatus;
exports.computeExpiryStatus = computeExpiryStatus;
exports.isExpired = isExpired;
exports.EXPIRY_SOON_DAYS = 30;
function computeStockStatus(currentStock, lowStockThreshold) {
    if (currentStock <= 0)
        return 'out';
    if (currentStock <= lowStockThreshold)
        return 'low';
    return 'adequate';
}
function computeExpiryStatus(expiryDate, now = new Date()) {
    if (expiryDate.getTime() <= now.getTime())
        return 'expired';
    const soonThreshold = now.getTime() + exports.EXPIRY_SOON_DAYS * 24 * 60 * 60 * 1000;
    if (expiryDate.getTime() <= soonThreshold)
        return 'expiring_soon';
    return 'ok';
}
function isExpired(expiryDate, now = new Date()) {
    return expiryDate.getTime() <= now.getTime();
}
//# sourceMappingURL=medicine-status.js.map