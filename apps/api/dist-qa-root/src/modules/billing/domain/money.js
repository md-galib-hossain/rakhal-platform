"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round2 = round2;
exports.clampNonNegative = clampNonNegative;
exports.computeInvoiceTotal = computeInvoiceTotal;
exports.computeTax = computeTax;
exports.computeGrandTotal = computeGrandTotal;
const client_1 = require("@prisma/client");
function round2(value) {
    return value.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function clampNonNegative(value) {
    return value.isNegative() ? new client_1.Prisma.Decimal(0) : value;
}
function computeInvoiceTotal(subtotal, discountTotal) {
    return clampNonNegative(round2(subtotal.minus(discountTotal)));
}
function computeTax(taxableBase, ratePct) {
    if (ratePct.isZero() || taxableBase.isZero())
        return new client_1.Prisma.Decimal(0);
    return round2(clampNonNegative(taxableBase).times(ratePct).dividedBy(100));
}
function computeGrandTotal(subtotal, discountTotal, taxAmount, creditApplied) {
    const netAfterDiscount = clampNonNegative(subtotal.minus(discountTotal));
    return clampNonNegative(round2(netAfterDiscount.plus(taxAmount).minus(creditApplied)));
}
//# sourceMappingURL=money.js.map