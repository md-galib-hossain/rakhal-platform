"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeMetricModule = void 0;
const money_1 = require("src/common/money");
const metric_value_1 = require("../../../domain/contracts/metric-value");
const finance_definitions_1 = require("./finance-definitions");
const finance_queries_1 = require("./finance-queries");
const UNIT = 'BDT';
const defs = new Map(finance_definitions_1.FINANCE_DEFINITIONS.map((d) => [d.id, d]));
const num = (m) => (0, metric_value_1.valueOf)((0, money_1.round2)(m).toNumber(), UNIT);
const NO_ACCOUNTS = {
    state: 'missing',
    reason: 'No financial accounts recorded for this farm',
};
const emptyQuality = (notes) => ({
    coverage: { expected: 0, recorded: 0 },
    notes,
    flags: {
        incompleteCoverage: false,
        hasUnsubmittedDrafts: false,
        hasEstimatedValues: false,
        hasUnknownCosts: false,
        groupMembershipCurrentOnly: false,
    },
});
function result(id, value, source, previous) {
    return {
        metricId: id,
        value,
        source,
        comparison: previous ? (0, metric_value_1.compareMetric)(value, previous) : null,
        requiresPermission: 'finance.read',
    };
}
async function cashSide(ctx, ids, p) {
    if (ids.length === 0)
        return { received: NO_ACCOUNTS, paid: NO_ACCOUNTS, net: NO_ACCOUNTS };
    const f = await (0, finance_queries_1.cashFlow)(ctx.db, ids, new Date(p.start), new Date(p.end));
    return {
        received: num(f.received),
        paid: num(f.paid),
        net: num((0, money_1.subtract)(f.received, f.paid)),
    };
}
async function expenseSide(ctx, p) {
    const byCat = await (0, finance_queries_1.expensesByCategory)(ctx.db, ctx.farmId, new Date(p.start), new Date(p.end));
    let total = (0, money_1.zero)();
    for (const v of byCat.values())
        total = (0, money_1.add)(total, v);
    return { byCat, total };
}
async function compute(ctx) {
    const section = {
        id: 'finance',
        domain: 'finance',
        titleKey: 'reports.sections.finance',
        metrics: [],
    };
    if (!ctx.includeFinance)
        return { section: null, exceptions: [], dataQuality: emptyQuality([]) };
    const notes = [];
    const ids = await (0, finance_queries_1.cashLedgerIds)(ctx.db, ctx.farmId);
    if (ids.length === 0)
        notes.push('No financial accounts: cash figures unavailable.');
    const cur = await cashSide(ctx, ids, ctx.period);
    const prev = ctx.previousPeriod
        ? await cashSide(ctx, ids, ctx.previousPeriod)
        : null;
    const src = 'cash_ledger';
    section.metrics.push(result(finance_definitions_1.CASH_RECEIVED_ID, cur.received, src, prev?.received ?? null), result(finance_definitions_1.CASH_PAID_ID, cur.paid, src, prev?.paid ?? null), result(finance_definitions_1.NET_CASH_FLOW_ID, cur.net, src, prev?.net ?? null));
    if (ids.length === 0) {
        section.metrics.push(result(finance_definitions_1.OPENING_CASH_ID, NO_ACCOUNTS, src, null), result(finance_definitions_1.CLOSING_CASH_ID, NO_ACCOUNTS, src, null));
    }
    else {
        const open = await (0, finance_queries_1.balanceBefore)(ctx.db, ids, new Date(ctx.period.start));
        const close = await (0, finance_queries_1.balanceBefore)(ctx.db, ids, new Date(ctx.period.end));
        const pp = ctx.previousPeriod;
        const prevOpen = pp
            ? num(await (0, finance_queries_1.balanceBefore)(ctx.db, ids, new Date(pp.start)))
            : null;
        const prevClose = pp
            ? num(await (0, finance_queries_1.balanceBefore)(ctx.db, ids, new Date(pp.end)))
            : null;
        section.metrics.push(result(finance_definitions_1.OPENING_CASH_ID, num(open), src, prevOpen), result(finance_definitions_1.CLOSING_CASH_ID, num(close), src, prevClose));
    }
    const ec = await expenseSide(ctx, ctx.period);
    const ep = ctx.previousPeriod
        ? await expenseSide(ctx, ctx.previousPeriod)
        : null;
    const esrc = 'expense_accrual';
    section.metrics.push(result(finance_definitions_1.EXPENSES_TOTAL_ID, num(ec.total), esrc, ep ? num(ep.total) : null));
    const cats = new Set([...ec.byCat.keys(), ...(ep?.byCat.keys() ?? [])]);
    for (const c of [...cats].sort()) {
        const id = (0, finance_definitions_1.expenseCategoryId)(c);
        if (!defs.has(id))
            continue;
        section.metrics.push(result(id, num(ec.byCat.get(c) ?? (0, money_1.zero)()), esrc, ep ? num(ep.byCat.get(c) ?? (0, money_1.zero)()) : null));
    }
    return { section, exceptions: [], dataQuality: emptyQuality(notes) };
}
exports.financeMetricModule = {
    definitions: finance_definitions_1.FINANCE_DEFINITIONS,
    compute,
};
//# sourceMappingURL=index.js.map