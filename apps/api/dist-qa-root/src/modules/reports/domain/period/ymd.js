"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertYmd = assertYmd;
exports.addDaysYmd = addDaysYmd;
exports.diffDaysYmd = diffDaysYmd;
exports.isoWeekday = isoWeekday;
exports.mondayOf = mondayOf;
exports.parseYmd = parseYmd;
exports.makeYmd = makeYmd;
exports.daysInMonth = daysInMonth;
exports.isoWeekOf = isoWeekOf;
exports.enumerateYmd = enumerateYmd;
const errors_1 = require("./errors");
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function toUtcMs(ymd) {
    const m = YMD_RE.exec(ymd);
    if (!m)
        throw new errors_1.InvalidDateError(ymd);
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const ms = Date.UTC(y, mo - 1, d);
    const back = new Date(ms);
    if (back.getUTCFullYear() !== y ||
        back.getUTCMonth() !== mo - 1 ||
        back.getUTCDate() !== d) {
        throw new errors_1.InvalidDateError(ymd);
    }
    return ms;
}
const fromUtcMs = (ms) => new Date(ms).toISOString().slice(0, 10);
function assertYmd(ymd) {
    toUtcMs(ymd);
    return ymd;
}
function addDaysYmd(ymd, days) {
    return fromUtcMs(toUtcMs(ymd) + days * 86_400_000);
}
function diffDaysYmd(a, b) {
    return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}
function isoWeekday(ymd) {
    const d = new Date(toUtcMs(ymd)).getUTCDay();
    return d === 0 ? 7 : d;
}
function mondayOf(ymd) {
    return addDaysYmd(ymd, -(isoWeekday(ymd) - 1));
}
function parseYmd(ymd) {
    toUtcMs(ymd);
    const [y, m, d] = ymd.split('-').map(Number);
    return { y, m, d };
}
function makeYmd(y, m, d) {
    return fromUtcMs(Date.UTC(y, m - 1, d));
}
function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function isoWeekOf(ymd) {
    const thursday = addDaysYmd(mondayOf(ymd), 3);
    const { y } = parseYmd(thursday);
    const week = Math.floor(diffDaysYmd(`${y}-01-01`, thursday) / 7) + 1;
    return { year: y, week };
}
function enumerateYmd(from, to) {
    const n = diffDaysYmd(from, to);
    const out = [];
    for (let i = 0; i <= n; i++)
        out.push(addDaysYmd(from, i));
    return out;
}
//# sourceMappingURL=ymd.js.map