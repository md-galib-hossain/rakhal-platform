"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.valueOf = void 0;
exports.safePercentChange = safePercentChange;
exports.compareMetric = compareMetric;
const valueOf = (value, unit) => ({
    state: 'value',
    value,
    unit,
});
exports.valueOf = valueOf;
function safePercentChange(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0)
        return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}
function compareMetric(current, previous) {
    const bothValues = current.state === 'value' && previous.state === 'value';
    return {
        current,
        previous,
        absoluteChange: bothValues ? current.value - previous.value : null,
        percentChange: bothValues
            ? safePercentChange(current.value, previous.value)
            : null,
        previousState: previous.state,
    };
}
//# sourceMappingURL=metric-value.js.map