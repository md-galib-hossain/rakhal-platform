"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCouponDiscount = computeCouponDiscount;
const money_1 = require("./money");
function computeCouponDiscount(coupon, subtotal) {
    let raw;
    switch (coupon.type) {
        case 'PERCENT':
            raw = subtotal.times(coupon.value).dividedBy(100);
            break;
        case 'FIXED':
            raw = coupon.value;
            break;
        case 'FREE_DAYS':
            raw = subtotal;
            break;
    }
    const discount = (0, money_1.clampNonNegative)((0, money_1.round2)(raw));
    return discount.gt(subtotal) ? subtotal : discount;
}
//# sourceMappingURL=coupon-pricing.js.map