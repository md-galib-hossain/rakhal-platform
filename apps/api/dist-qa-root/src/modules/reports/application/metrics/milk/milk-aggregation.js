"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayKey = void 0;
exports.aggregateMilk = aggregateMilk;
exports.rankCows = rankCows;
exports.evaluateSuddenDrops = evaluateSuddenDrops;
const lactation_curve_1 = require("../../../../reproduction/domain/lactation-curve");
const lactation_alerts_1 = require("../../../../reproduction/domain/lactation-alerts");
const predicates_1 = require("../../../domain/eligibility/predicates");
const period_1 = require("../../../domain/period");
const dayKey = (d) => d.toISOString().slice(0, 10);
exports.dayKey = dayKey;
const round2 = (n) => Math.round(n * 100) / 100;
function aggregateMilk(input) {
    const cows = new Set(input.cattleIds);
    const dayList = [...input.days];
    let estimated = !input.presence;
    const expectedFor = (cattleId) => {
        const w = input.presence?.get(cattleId);
        if (!w) {
            if (input.presence)
                estimated = true;
            return dayList.length;
        }
        return dayList.filter((d) => d >= w.startDate && d <= w.endDate).length;
    };
    const expectedByCow = new Map([...cows].map((id) => [id, expectedFor(id)]));
    const daySet = new Set(dayList);
    const perCowMap = new Map();
    const perDay = new Map();
    const dispositions = {};
    let total = 0;
    let any = false;
    for (const r of input.rows) {
        if (!cows.has(r.cattleId) || !(0, predicates_1.isMilkEligibleRow)(r))
            continue;
        const k = (0, exports.dayKey)(r.logDate);
        if (!daySet.has(k))
            continue;
        any = true;
        total += r.yieldL;
        const c = perCowMap.get(r.cattleId) ?? { total: 0, days: new Set() };
        c.total += r.yieldL;
        c.days.add(k);
        perCowMap.set(r.cattleId, c);
        const d = perDay.get(k) ?? { total: 0, cows: new Set() };
        d.total += r.yieldL;
        d.cows.add(r.cattleId);
        perDay.set(k, d);
        dispositions[r.disposition] = (dispositions[r.disposition] ?? 0) + r.yieldL;
    }
    const perCow = [...perCowMap.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([cattleId, c]) => ({
        cattleId,
        totalYieldL: round2(c.total),
        recordedDays: c.days.size,
        expectedDays: expectedFor(cattleId),
        avgPerRecordedDayL: round2(c.total / c.days.size),
    }));
    const recordedCowDays = perCow.reduce((s, c) => s + c.recordedDays, 0);
    for (const k of Object.keys(dispositions)) {
        dispositions[k] = round2(dispositions[k]);
    }
    return {
        days: dayList,
        cowCount: cows.size,
        totalYieldL: any ? round2(total) : null,
        recordedCowDays,
        expectedCowDays: [...expectedByCow.values()].reduce((s, n) => s + n, 0),
        expectedEstimated: estimated,
        expectedDaysByCow: Object.fromEntries(expectedByCow),
        avgDailyYieldPerRecordedCowDayL: recordedCowDays > 0 ? round2(total / recordedCowDays) : null,
        cowsWithData: perCow.length,
        daily: dayList.map((date) => {
            const d = perDay.get(date);
            return {
                date,
                yieldL: d ? round2(d.total) : null,
                cowsRecorded: d?.cows.size ?? 0,
            };
        }),
        perCow,
        cowsWithoutData: [...cows].filter((id) => !perCowMap.has(id)).sort(),
        dispositionTotalsL: dispositions,
    };
}
function rankCows(perCow, n = 5) {
    const sorted = [...perCow].sort((a, b) => b.avgPerRecordedDayL - a.avgPerRecordedDayL ||
        (a.cattleId < b.cattleId ? -1 : 1));
    const top = sorted.slice(0, n);
    const rest = sorted.slice(top.length);
    const bottom = rest.slice(-n).reverse();
    return { top, bottom };
}
function evaluateSuddenDrops(input) {
    const out = { evaluatedCows: 0, findings: [] };
    if (!input.evaluatedDate)
        return out;
    const cows = new Set(input.cattleIds);
    const from = (0, period_1.addDaysYmd)(input.evaluatedDate, -7);
    const byCow = new Map();
    for (const r of input.rows) {
        if (!cows.has(r.cattleId) || !(0, predicates_1.isMilkEligibleRow)(r))
            continue;
        const k = (0, exports.dayKey)(r.logDate);
        if (k < from || k > input.evaluatedDate)
            continue;
        const list = byCow.get(r.cattleId) ?? [];
        list.push({ logDate: r.logDate, session: r.session, yieldL: r.yieldL });
        byCow.set(r.cattleId, list);
    }
    for (const cattleId of [...byCow.keys()].sort()) {
        const series = (0, lactation_curve_1.buildDailyYieldSeries)({
            startDate: new Date(`${from}T00:00:00.000Z`),
            endDate: new Date(`${input.evaluatedDate}T00:00:00.000Z`),
            entries: byCow.get(cattleId) ?? [],
            expectedSessions: input.expectedSessions,
        });
        if (series.length !== 8 || series.some((p) => p.dataQuality !== 'complete'))
            continue;
        out.evaluatedCows++;
        const baseline = series.slice(0, 7);
        const res = (0, lactation_alerts_1.detectSuddenDrop)({
            evaluatedDayYieldL: series[7].yieldL,
            evaluatedDayDataQuality: series[7].dataQuality,
            baselineDaysDataQuality: baseline.map((p) => p.dataQuality),
            baselineAvgYieldL: baseline.reduce((s, p) => s + p.yieldL, 0) / 7,
            dropThresholdPct: input.dropThresholdPct,
        });
        if (res.fired && res.dropPct !== null)
            out.findings.push({ cattleId, dropPct: res.dropPct });
    }
    return out;
}
//# sourceMappingURL=milk-aggregation.js.map