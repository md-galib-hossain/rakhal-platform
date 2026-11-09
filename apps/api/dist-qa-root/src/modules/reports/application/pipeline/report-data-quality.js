"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDataQuality = void 0;
exports.mergeDataQuality = mergeDataQuality;
const emptyDataQuality = () => ({
    coverage: { expected: 0, recorded: 0 },
    notes: [],
    flags: {
        incompleteCoverage: false,
        hasUnsubmittedDrafts: false,
        hasEstimatedValues: false,
        hasUnknownCosts: false,
        groupMembershipCurrentOnly: false,
    },
});
exports.emptyDataQuality = emptyDataQuality;
function mergeDataQuality(parts) {
    const out = (0, exports.emptyDataQuality)();
    const notes = new Set();
    for (const p of parts) {
        out.coverage.expected += p.coverage.expected;
        out.coverage.recorded += p.coverage.recorded;
        for (const n of p.notes)
            notes.add(n);
        out.flags.incompleteCoverage ||= p.flags.incompleteCoverage;
        out.flags.hasUnsubmittedDrafts ||= p.flags.hasUnsubmittedDrafts;
        out.flags.hasEstimatedValues ||= p.flags.hasEstimatedValues;
        out.flags.hasUnknownCosts ||= p.flags.hasUnknownCosts;
        out.flags.groupMembershipCurrentOnly ||= p.flags.groupMembershipCurrentOnly;
    }
    out.notes = [...notes];
    return out;
}
//# sourceMappingURL=report-data-quality.js.map