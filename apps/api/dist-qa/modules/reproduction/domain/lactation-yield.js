"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOfUtcDay = startOfUtcDay;
exports.daysBetween = daysBetween;
exports.sumYieldForDay = sumYieldForDay;
exports.averageDailyYield = averageDailyYield;
exports.totalsByDisposition = totalsByDisposition;
exports.computeLactationPeak = computeLactationPeak;
const client_1 = require("@prisma/client");
const DAY_MS = 24 * 60 * 60 * 1000;
function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function daysBetween(start, end) {
    return Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS);
}
function sumYieldForDay(entries, day) {
    const target = startOfUtcDay(day).getTime();
    return round(entries
        .filter((e) => startOfUtcDay(e.logDate).getTime() === target)
        .reduce((sum, e) => sum + e.yieldL, 0));
}
function averageDailyYield(entries, params) {
    const { referenceDate, windowDays, lactationStart } = params;
    const elapsedDays = Math.max(1, daysBetween(lactationStart, referenceDate) + 1);
    const effectiveDays = Math.min(windowDays, elapsedDays);
    const windowStart = new Date(referenceDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - (effectiveDays - 1));
    const windowStartDay = startOfUtcDay(windowStart).getTime();
    const windowEndDay = startOfUtcDay(referenceDate).getTime();
    const total = entries
        .filter((e) => {
        const day = startOfUtcDay(e.logDate).getTime();
        return day >= windowStartDay && day <= windowEndDay;
    })
        .reduce((sum, e) => sum + e.yieldL, 0);
    return round(total / effectiveDays);
}
function totalsByDisposition(entries) {
    const totals = {
        produced: 0,
        saleable: 0,
        withheld: 0,
        colostrum: 0,
        calfFeed: 0,
        discarded: 0,
        householdUse: 0,
    };
    for (const e of entries) {
        totals.produced += e.yieldL;
        switch (e.disposition) {
            case client_1.MilkDisposition.SALEABLE:
                totals.saleable += e.yieldL;
                break;
            case client_1.MilkDisposition.WITHHELD:
                totals.withheld += e.yieldL;
                break;
            case client_1.MilkDisposition.COLOSTRUM:
                totals.colostrum += e.yieldL;
                break;
            case client_1.MilkDisposition.CALF_FEED:
                totals.calfFeed += e.yieldL;
                break;
            case client_1.MilkDisposition.DISCARDED:
                totals.discarded += e.yieldL;
                break;
            case client_1.MilkDisposition.HOUSEHOLD_USE:
                totals.householdUse += e.yieldL;
                break;
        }
    }
    Object.keys(totals).forEach((key) => {
        totals[key] = round(totals[key]);
    });
    return totals;
}
function round(value) {
    return Math.round(value * 100) / 100;
}
function computeLactationPeak(series) {
    let best = null;
    for (const point of series) {
        if (point.dataQuality !== 'complete')
            continue;
        if (!best || point.yieldL > best.yieldL) {
            best = point;
        }
    }
    if (!best)
        return null;
    return {
        peakMilkYield: best.yieldL,
        peakMilkDate: new Date(`${best.date}T00:00:00.000Z`),
        peakDaysInMilk: best.dim,
    };
}
//# sourceMappingURL=lactation-yield.js.map