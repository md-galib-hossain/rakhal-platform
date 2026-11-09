"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthMetricModule = void 0;
const data_quality_1 = require("../../../domain/eligibility/data-quality");
const metric_value_1 = require("../../../domain/contracts/metric-value");
const health_aggregation_1 = require("./health-aggregation");
const health_definitions_1 = require("./health-definitions");
const health_fetch_1 = require("./health-fetch");
async function loadPeriodFigures(ctx, w, cattleIds) {
    const scope = { db: ctx.db, farmId: ctx.farmId, cattleIds };
    const [cases, treatments, tasks] = await Promise.all([
        (0, health_fetch_1.fetchCases)(scope, w),
        (0, health_fetch_1.fetchTreatments)(scope, w),
        (0, health_fetch_1.fetchTasks)(scope, w, null),
    ]);
    const opened = (0, health_aggregation_1.casesOpened)(cases, w);
    const treated = (0, health_aggregation_1.treatmentsGiven)(treatments);
    const openedCases = cases.filter((c) => c.startDate.getTime() >= w.start.getTime() &&
        c.startDate.getTime() < w.end.getTime());
    const candidates = openedCases.some((c) => c.condition)
        ? await (0, health_fetch_1.fetchRepeatCandidates)(scope, w, (0, health_aggregation_1.distinct)(openedCases.filter((c) => c.condition).map((c) => c.cattleId)), ctx.thresholds.repeatedCaseWindowDays)
        : [];
    const repeated = (0, health_aggregation_1.repeatedCases)(openedCases, candidates, ctx.thresholds.repeatedCaseWindowDays);
    let cost = null;
    let vet = null;
    let hasUnknownCosts = false;
    let hasPartialCosts = false;
    if (ctx.includeFinance) {
        const amounts = await (0, health_fetch_1.fetchExpenseAmounts)(scope, [
            ...treatments.map((t) => t.financeTransactionId),
            ...treatments.map((t) => t.vetExpenseId),
        ].filter((id) => !!id));
        const c = (0, health_aggregation_1.treatmentCost)(treatments, amounts);
        const v = (0, health_aggregation_1.vetFees)(treatments, amounts);
        cost = c.value;
        vet = v.value;
        hasUnknownCosts = c.hasUnresolved || v.hasUnresolved;
        hasPartialCosts = c.partial || v.partial;
    }
    return {
        casesOpened: opened.events,
        cowsWithCases: opened.cows.length,
        treatments: treated.events,
        cowsTreated: treated.cows.length,
        closed: (0, health_aggregation_1.casesClosed)(cases, w),
        recovered: (0, health_aggregation_1.casesRecovered)(cases, w),
        mortality: (0, health_aggregation_1.casesMortality)(cases, w),
        preventiveCompleted: (0, health_aggregation_1.preventiveCompleted)(tasks, w),
        preventiveMissed: (0, health_aggregation_1.preventiveMissed)(tasks, w),
        repeated: repeated.events,
        repeatedCows: repeated.cows,
        cost,
        vetFees: vet,
        hasUnknownCosts,
        hasPartialCosts,
    };
}
const NA = { state: 'not_applicable' };
function emptyOutput() {
    return {
        section: {
            id: 'health',
            domain: 'health',
            titleKey: 'reports.section.health',
            metrics: [],
        },
        exceptions: [],
        dataQuality: (0, data_quality_1.buildDataQuality)({
            coverage: { expected: 0, recorded: 0 },
            scopeEmpty: true,
        }),
    };
}
function withPartialNote(dq, partial) {
    return partial
        ? { ...dq, notes: [...dq.notes, 'reports.dq.partial_costs'] }
        : dq;
}
async function compute(ctx) {
    const defs = health_definitions_1.HEALTH_DEFINITIONS.filter((d) => ctx.includeFinance || d.requiresPermission !== 'finance.read');
    const metrics = [];
    if (ctx.cattleIds.length === 0) {
        const out = emptyOutput();
        return {
            ...out,
            section: {
                id: 'health',
                domain: 'health',
                titleKey: 'reports.section.health',
                metrics: defs.map((d) => ({
                    metricId: d.id,
                    value: NA,
                    source: null,
                    comparison: null,
                    requiresPermission: d.requiresPermission ?? null,
                })),
            },
        };
    }
    const w = (0, health_fetch_1.toWindow)(ctx.period);
    const scope = { db: ctx.db, farmId: ctx.farmId, cattleIds: ctx.cattleIds };
    const cur = await loadPeriodFigures(ctx, w, ctx.cattleIds);
    let prev = null;
    if (ctx.previousPeriod && ctx.previousCattleIds.length > 0) {
        prev = await loadPeriodFigures(ctx, (0, health_fetch_1.toWindow)(ctx.previousPeriod), ctx.previousCattleIds);
    }
    const [openCases, taskRows, withdrawals] = await Promise.all([
        (0, health_fetch_1.fetchCases)(scope, w),
        (0, health_fetch_1.fetchTasks)(scope, w, ctx.generatedAt),
        (0, health_fetch_1.fetchActiveWithdrawals)(scope),
    ]);
    const overdue = (0, health_aggregation_1.overdueTasks)(taskRows, ctx.generatedAt);
    const active = (0, health_aggregation_1.activeWithdrawals)(withdrawals);
    const add = (id, pick, source = null) => {
        const def = defs.find((d) => d.id === id);
        if (!def)
            return;
        const c = pick(cur);
        if (c === null)
            return;
        const value = typeof c === 'number' ? (0, metric_value_1.valueOf)(c, def.unit) : c;
        let comparison = null;
        if (ctx.previousPeriod) {
            const p = prev ? pick(prev) : null;
            comparison = (0, metric_value_1.compareMetric)(value, p === null ? NA : typeof p === 'number' ? (0, metric_value_1.valueOf)(p, def.unit) : p);
        }
        metrics.push({
            metricId: id,
            value,
            source,
            comparison,
            requiresPermission: def.requiresPermission ?? null,
        });
    };
    const addPoint = (id, n) => {
        const def = defs.find((d) => d.id === id);
        metrics.push({
            metricId: id,
            value: (0, metric_value_1.valueOf)(n, def.unit),
            source: null,
            comparison: null,
            requiresPermission: null,
        });
    };
    add('health.cases_opened', (f) => f.casesOpened);
    add('health.cows_with_cases_opened', (f) => f.cowsWithCases);
    add('health.treatments_given', (f) => f.treatments);
    add('health.cows_treated', (f) => f.cowsTreated);
    add('health.cases_closed', (f) => f.closed);
    add('health.cases_recovered', (f) => f.recovered);
    add('health.cases_mortality', (f) => f.mortality);
    addPoint('health.cases_open_at_period_end', (0, health_aggregation_1.casesOpenAt)(openCases, w.end));
    add('health.preventive_tasks_completed', (f) => f.preventiveCompleted);
    add('health.preventive_tasks_missed', (f) => f.preventiveMissed);
    addPoint('health.tasks_overdue', overdue.length);
    add('health.cases_repeated', (f) => f.repeated);
    addPoint('health.withdrawals_active', active.events);
    add('health.treatment_cost', (f) => f.cost);
    add('health.vet_fees', (f) => f.vetFees, 'vet_fee');
    const exceptions = [];
    if (overdue.length > 0) {
        exceptions.push({
            code: 'health.overdue_tasks',
            domain: 'health',
            messageKey: 'reports.exceptions.health.overdue_tasks',
            cattleIds: (0, health_aggregation_1.distinct)(overdue.map((t) => t.cattleId)),
        });
    }
    if (cur.repeatedCows.length > 0) {
        exceptions.push({
            code: 'health.repeated_cases',
            domain: 'health',
            messageKey: 'reports.exceptions.health.repeated_cases',
            cattleIds: cur.repeatedCows,
        });
    }
    return {
        section: {
            id: 'health',
            domain: 'health',
            titleKey: 'reports.section.health',
            metrics,
        },
        exceptions,
        dataQuality: withPartialNote((0, data_quality_1.buildDataQuality)({
            coverage: {
                expected: ctx.cattleIds.length,
                recorded: ctx.cattleIds.length,
            },
            hasUnknownCosts: ctx.includeFinance && cur.hasUnknownCosts,
        }), ctx.includeFinance && cur.hasPartialCosts),
    };
}
exports.healthMetricModule = {
    definitions: health_definitions_1.HEALTH_DEFINITIONS,
    compute,
};
//# sourceMappingURL=health-metrics.js.map