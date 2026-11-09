"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINANCE_SOURCE_DENYLIST = void 0;
exports.assertNoFinance = assertNoFinance;
exports.FINANCE_SOURCE_DENYLIST = [
    'cash_ledger',
    'expense_accrual',
    'ledgerFeed5000',
    'distributionCost',
    'vet_fee',
];
const isFinanceUnit = (u) => u === 'BDT' || u.startsWith('BDT/');
const isFinanceSource = (src) => !!src && (exports.FINANCE_SOURCE_DENYLIST.includes(src) || src.startsWith('ledger'));
const isFinanceException = (e) => e.domain === 'finance' || /cost|cash|ledger/i.test(e.code);
function checkValue(v, where) {
    if (v && v.state === 'value' && isFinanceUnit(v.unit)) {
        throw new Error(`Finance unit "${v.unit}" in ${where} of finance-free report`);
    }
}
function assertNoFinance(payload) {
    if (payload.includesFinance)
        return;
    for (const s of payload.sections) {
        if (s.domain === 'finance')
            throw new Error(`Finance section "${s.id}" in finance-free report`);
        for (const m of s.metrics) {
            if (m.requiresPermission === 'finance.read') {
                throw new Error(`Finance metric "${m.metricId}" in finance-free report`);
            }
            if (String(m.metricId).startsWith('finance.')) {
                throw new Error(`Finance metric id "${m.metricId}" in finance-free report`);
            }
            if (isFinanceSource(m.source)) {
                throw new Error(`Finance source "${m.source}" on "${m.metricId}" in finance-free report`);
            }
            const where = `metric "${m.metricId}"`;
            checkValue(m.value, where);
            checkValue(m.comparison?.current, where);
            checkValue(m.comparison?.previous, where);
            for (const p of m.series ?? [])
                checkValue(p.value, `${where} series`);
            for (const r of m.rows ?? []) {
                if (isFinanceSource(r.source)) {
                    throw new Error(`Finance source "${r.source}" on row "${r.key}" of "${m.metricId}" in finance-free report`);
                }
                checkValue(r.value, `${where} row "${r.key}"`);
            }
        }
    }
    for (const e of payload.exceptions) {
        if (isFinanceException(e)) {
            throw new Error(`Finance exception "${e.code}" in finance-free report`);
        }
    }
}
//# sourceMappingURL=snapshot.js.map