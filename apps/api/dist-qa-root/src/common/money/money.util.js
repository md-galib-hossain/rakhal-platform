"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMoney = toMoney;
exports.zero = zero;
exports.add = add;
exports.subtract = subtract;
exports.multiply = multiply;
exports.sum = sum;
exports.gt = gt;
exports.gte = gte;
exports.lt = lt;
exports.lte = lte;
exports.eq = eq;
exports.isZero = isZero;
exports.isNegative = isNegative;
exports.clampNonNegative = clampNonNegative;
exports.round2 = round2;
exports.toStorage = toStorage;
const client_1 = require("@prisma/client");
function toMoney(value) {
    return new client_1.Prisma.Decimal(value);
}
function zero() {
    return new client_1.Prisma.Decimal(0);
}
function add(a, b) {
    return toMoney(a).plus(toMoney(b));
}
function subtract(a, b) {
    return toMoney(a).minus(toMoney(b));
}
function multiply(a, factor) {
    return toMoney(a).times(toMoney(factor));
}
function sum(values) {
    return values.reduce((total, v) => add(total, v), zero());
}
function gt(a, b) {
    return toMoney(a).greaterThan(toMoney(b));
}
function gte(a, b) {
    return toMoney(a).greaterThanOrEqualTo(toMoney(b));
}
function lt(a, b) {
    return toMoney(a).lessThan(toMoney(b));
}
function lte(a, b) {
    return toMoney(a).lessThanOrEqualTo(toMoney(b));
}
function eq(a, b) {
    return toMoney(a).equals(toMoney(b));
}
function isZero(value) {
    return toMoney(value).isZero();
}
function isNegative(value) {
    return toMoney(value).isNegative();
}
function clampNonNegative(value) {
    const v = toMoney(value);
    return v.isNegative() ? zero() : v;
}
function round2(value) {
    return toMoney(value).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function toStorage(value) {
    return round2(value);
}
//# sourceMappingURL=money.util.js.map