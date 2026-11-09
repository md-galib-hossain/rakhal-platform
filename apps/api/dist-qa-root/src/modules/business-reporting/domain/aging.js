"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECEIVABLE_AGING_BUCKETS = void 0;
exports.buildAgingBucketCaseSql = buildAgingBucketCaseSql;
exports.RECEIVABLE_AGING_BUCKETS = [
    { key: 'CURRENT', label: 'Current (0–7 days)', minDays: 0, maxDays: 7 },
    {
        key: 'OVERDUE_8_30',
        label: 'Overdue 8–30 days',
        minDays: 8,
        maxDays: 30,
    },
    {
        key: 'OVERDUE_31_PLUS',
        label: 'Overdue 31+ days',
        minDays: 31,
        maxDays: null,
    },
];
function buildAgingBucketCaseSql(daysExpr) {
    const whens = exports.RECEIVABLE_AGING_BUCKETS.map((b) => b.maxDays === null
        ? `ELSE '${b.key}'`
        : `WHEN ${daysExpr} <= ${b.maxDays} THEN '${b.key}'`);
    return `CASE ${whens.join(' ')} END`;
}
//# sourceMappingURL=aging.js.map