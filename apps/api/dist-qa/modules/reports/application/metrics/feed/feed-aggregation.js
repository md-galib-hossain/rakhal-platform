"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round2 = void 0;
exports.computePeriodFigures = computePeriodFigures;
exports.findLowStock = findLowStock;
exports.persistentlyOffTarget = persistentlyOffTarget;
const metric_value_1 = require("../../../domain/contracts/metric-value");
const feed_definitions_1 = require("./feed-definitions");
const round2 = (n) => Math.round(n * 100) / 100;
exports.round2 = round2;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
function sumOrMissing(xs, unit, reason) {
    return xs.length === 0
        ? { state: 'missing', reason }
        : (0, metric_value_1.valueOf)((0, exports.round2)(sum(xs)), unit);
}
function topN(map) {
    return Array.from(map.values())
        .map((r) => ({ ...r, kg: (0, exports.round2)(r.kg) }))
        .sort((a, b) => b.kg - a.kg || a.key.localeCompare(b.key))
        .slice(0, feed_definitions_1.MAX_BREAKDOWN_ROWS);
}
function computePeriodFigures(raw) {
    const { distributions, cattleItems, fitDays } = raw;
    const actualKg = sumOrMissing(distributions.map((d) => d.totalActualKg), 'kg', 'no feed distribution recorded in period');
    const refusalKg = sumOrMissing(distributions.map((d) => d.totalRefusalKg), 'kg', 'no feed distribution recorded in period');
    const offeredMinusRefusalKg = sumOrMissing(cattleItems.map((r) => r.offeredKg - r.refusalKg), 'kg', 'no per-cow feeding rows in period');
    const byCowMap = new Map();
    for (const r of cattleItems) {
        const cur = byCowMap.get(r.cattleId) ?? {
            key: r.cattleId,
            label: null,
            kg: 0,
        };
        cur.kg += r.offeredKg - r.refusalKg;
        byCowMap.set(r.cattleId, cur);
    }
    const byItemMap = new Map();
    for (const d of distributions) {
        for (const i of d.items) {
            const cur = byItemMap.get(i.ingredientId) ?? {
                key: i.ingredientId,
                label: i.ingredientName,
                kg: 0,
            };
            cur.kg += i.actualKg;
            byItemMap.set(i.ingredientId, cur);
        }
    }
    const costRows = cattleItems.length;
    const known = cattleItems.filter((r) => r.costTk !== null);
    const unknownCostRows = costRows - known.length;
    const knownSum = sum(known.map((r) => r.costTk));
    let distributionCost;
    if (costRows === 0) {
        distributionCost = {
            state: 'missing',
            reason: 'no per-cow feeding rows in period',
        };
    }
    else if (unknownCostRows > 0) {
        distributionCost = {
            state: 'missing',
            reason: `${unknownCostRows} of ${costRows} feeding rows have unknown cost`,
        };
    }
    else {
        distributionCost = (0, metric_value_1.valueOf)((0, exports.round2)(knownSum), 'BDT');
    }
    const distributionCostKnownOnly = known.length === 0
        ? { state: 'missing', reason: 'no feeding rows with a known cost' }
        : (0, metric_value_1.valueOf)((0, exports.round2)(knownSum), 'BDT');
    const costCoveragePct = costRows === 0
        ? { state: 'missing', reason: 'no per-cow feeding rows in period' }
        : (0, metric_value_1.valueOf)((0, exports.round2)((known.length / costRows) * 100), '%');
    const fedCowDays = new Set(cattleItems.map((r) => `${r.cattleId}|${r.dayKey}`)).size;
    const costPerCowDay = distributionCost.state === 'value' && fedCowDays > 0
        ? (0, metric_value_1.valueOf)((0, exports.round2)(distributionCost.value / fedCowDays), 'BDT/cow-day')
        : {
            state: 'not_calculated',
            reason: distributionCost.state !== 'value'
                ? 'distribution cost is not a complete value'
                : 'no fed cow-days',
        };
    const costPerLitre = distributionCost.state === 'value' &&
        raw.milk.rows > 0 &&
        raw.milk.litres > 0
        ? (0, metric_value_1.valueOf)((0, exports.round2)(distributionCost.value / raw.milk.litres), 'BDT/L')
        : {
            state: 'not_calculated',
            reason: distributionCost.state !== 'value'
                ? 'distribution cost is not a complete value'
                : 'no submitted milk litres for in-scope cows',
        };
    const ledgerFeedSpend = raw.ledgerNet === null && raw.ledgerAccountExists
        ? null
        : !raw.ledgerAccountExists
            ? { state: 'missing', reason: 'ledger account 5000 does not exist' }
            : (0, metric_value_1.valueOf)((0, exports.round2)(raw.ledgerNet), 'BDT');
    const firm = fitDays.filter((f) => !f.estimated);
    const estimatedFitCowDays = fitDays.length - firm.length;
    const fitOffTargetSharePct = firm.length === 0
        ? { state: 'missing', reason: 'no non-estimated plan-fit days in period' }
        : (0, metric_value_1.valueOf)((0, exports.round2)((firm.filter((f) => f.severity !== 'OK').length / firm.length) *
            100), '%');
    const fitEstimatedCowDays = fitDays.length === 0
        ? { state: 'missing', reason: 'no plan-fit days in period' }
        : (0, metric_value_1.valueOf)(estimatedFitCowDays, 'cow-days');
    const tmrFedKg = raw.fedMovementKgs.length === 0
        ? { state: 'missing', reason: 'no FED stock movements in period' }
        : (0, metric_value_1.valueOf)((0, exports.round2)(-sum(raw.fedMovementKgs) + 0), 'kg');
    return {
        actualKg,
        refusalKg,
        offeredMinusRefusalKg,
        distributionCost,
        distributionCostKnownOnly,
        costCoveragePct,
        costPerCowDay,
        costPerLitre,
        ledgerFeedSpend,
        fitOffTargetSharePct,
        fitEstimatedCowDays,
        tmrFedKg,
        byCow: topN(byCowMap),
        byItem: topN(byItemMap),
        costRows,
        unknownCostRows,
        fedCowDays,
        estimatedFitCowDays,
    };
}
function findLowStock(items) {
    return items
        .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        threshold: i.threshold,
        stock: (0, exports.round2)(sum(i.batchStocks)),
    }))
        .filter((i) => i.threshold > 0 && i.stock <= i.threshold)
        .sort((a, b) => a.stock - b.stock || a.id.localeCompare(b.id));
}
function persistentlyOffTarget(days, minDays) {
    if (minDays === null || minDays < 1)
        return [];
    const byCow = new Map();
    for (const d of days) {
        if (d.estimated)
            continue;
        const list = byCow.get(d.cattleId) ?? [];
        list.push({ date: d.date, off: d.severity !== 'OK' });
        byCow.set(d.cattleId, list);
    }
    const out = [];
    for (const [cattleId, list] of byCow) {
        list.sort((a, b) => b.date.localeCompare(a.date));
        let run = 0;
        for (const d of list) {
            if (!d.off)
                break;
            run++;
        }
        if (run >= minDays)
            out.push(cattleId);
    }
    return out.sort();
}
//# sourceMappingURL=feed-aggregation.js.map