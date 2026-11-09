"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPEATED_FAILED_SERVICES_THRESHOLD = exports.MIN_DECIDED_FOR_CONCEPTION_RATE = void 0;
exports.isOverdueCheck = isOverdueCheck;
exports.aggregateServices = aggregateServices;
exports.conceptionRate = conceptionRate;
exports.sumLinkedCost = sumLinkedCost;
const eligibility_1 = require("../../../domain/eligibility");
const money_1 = require("src/common/money");
exports.MIN_DECIDED_FOR_CONCEPTION_RATE = 5;
exports.REPEATED_FAILED_SERVICES_THRESHOLD = 3;
const METHODS = ['AI', 'NATURAL', 'EMBRYO_TRANSFER'];
function isOverdueCheck(row, now) {
    return ((0, eligibility_1.classifyBreedingStatus)(row.status) === 'pending' &&
        row.expectedPregnancyCheckDate !== null &&
        row.expectedPregnancyCheckDate.getTime() < now.getTime());
}
function aggregateServices(rows, now) {
    const eligible = rows.filter((r) => (0, eligibility_1.isReproductionEligible)(r));
    const all = new Set();
    const methodCows = {
        AI: new Set(),
        NATURAL: new Set(),
        EMBRYO_TRANSFER: new Set(),
    };
    const agg = {
        total: eligible.length,
        uniqueCows: 0,
        byMethod: {
            AI: { events: 0, uniqueCows: 0 },
            NATURAL: { events: 0, uniqueCows: 0 },
            EMBRYO_TRANSFER: { events: 0, uniqueCows: 0 },
        },
        confirmed: 0,
        pending: 0,
        failed: 0,
        other: 0,
        decided: 0,
        overdueChecks: 0,
        dueForCheck: 0,
        cowsWithRepeatedFailures: [],
        aiWithoutCostLink: 0,
    };
    const failedPerCow = new Map();
    for (const r of eligible) {
        all.add(r.cattleId);
        methodCows[r.breedingMethod].add(r.cattleId);
        agg.byMethod[r.breedingMethod].events++;
        if (r.breedingMethod === 'AI' && !r.financeTransactionId)
            agg.aiWithoutCostLink++;
        const cls = (0, eligibility_1.classifyBreedingStatus)(r.status);
        const overdue = isOverdueCheck(r, now);
        if (cls === 'confirmed')
            agg.confirmed++;
        else if (cls === 'failed') {
            agg.failed++;
            failedPerCow.set(r.cattleId, (failedPerCow.get(r.cattleId) ?? 0) + 1);
        }
        else if (cls === 'pending') {
            agg.pending++;
            if (overdue)
                agg.overdueChecks++;
        }
        else
            agg.other++;
        if (cls !== 'pending' || overdue)
            agg.dueForCheck++;
    }
    agg.uniqueCows = all.size;
    for (const m of METHODS)
        agg.byMethod[m].uniqueCows = methodCows[m].size;
    agg.decided = agg.confirmed + agg.failed;
    agg.cowsWithRepeatedFailures = [...failedPerCow]
        .filter(([, n]) => n >= exports.REPEATED_FAILED_SERVICES_THRESHOLD)
        .map(([id]) => id)
        .sort();
    return agg;
}
function conceptionRate(confirmed, failed, minDecided = exports.MIN_DECIDED_FOR_CONCEPTION_RATE) {
    const decided = confirmed + failed;
    if (decided === 0)
        return {
            state: 'not_calculated',
            reason: 'no decided services (all pending or none recorded)',
        };
    if (decided < minDecided)
        return {
            state: 'not_calculated',
            reason: `small cohort: ${decided} decided services, minimum ${minDecided}`,
        };
    return { state: 'value', value: (confirmed / decided) * 100, unit: '%' };
}
function sumLinkedCost(amounts) {
    return (0, money_1.sum)(amounts);
}
//# sourceMappingURL=repro-aggregation.js.map