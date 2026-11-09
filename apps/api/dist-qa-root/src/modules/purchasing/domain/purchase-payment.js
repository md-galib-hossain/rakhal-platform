"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePurchasePayment = derivePurchasePayment;
const payable_status_1 = require("./payable-status");
const cents = (v) => Math.round(Number(v) * 100);
const fmt = (c) => (c / 100).toFixed(2);
function derivePurchasePayment(totalAmount, voided, payable, allocated, now = new Date()) {
    const total = cents(totalAmount);
    if (voided) {
        return { paymentStatus: null, outstanding: fmt(0), paidAmount: fmt(0) };
    }
    if (!payable) {
        return {
            paymentStatus: payable_status_1.PayableStatus.PAID,
            outstanding: fmt(0),
            paidAmount: fmt(total),
        };
    }
    const owedAtCreation = cents(payable.totalAmount);
    const allocatedC = cents(allocated);
    const outstanding = Math.max(owedAtCreation - allocatedC, 0);
    let status;
    if (outstanding === 0) {
        status = payable_status_1.PayableStatus.PAID;
    }
    else if (payable.dueDate && payable.dueDate.getTime() < now.getTime()) {
        status = payable_status_1.PayableStatus.OVERDUE;
    }
    else if (allocatedC === 0) {
        status = payable_status_1.PayableStatus.UNPAID;
    }
    else {
        status = payable_status_1.PayableStatus.PARTIALLY_PAID;
    }
    return {
        paymentStatus: status,
        outstanding: fmt(outstanding),
        paidAmount: fmt(total - outstanding),
    };
}
//# sourceMappingURL=purchase-payment.js.map