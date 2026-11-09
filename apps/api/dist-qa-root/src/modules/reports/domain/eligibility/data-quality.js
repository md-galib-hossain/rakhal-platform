"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DQ_NOTE = void 0;
exports.buildCoverage = buildCoverage;
exports.coverageRatio = coverageRatio;
exports.isIncompleteCoverage = isIncompleteCoverage;
exports.missingKeys = missingKeys;
exports.valueOrMissing = valueOrMissing;
exports.buildDataQuality = buildDataQuality;
exports.DQ_NOTE = {
    incompleteCoverage: 'reports.dq.incomplete_coverage',
    unsubmittedDrafts: 'reports.dq.unsubmitted_drafts_excluded',
    estimatedValues: 'reports.dq.estimated_values',
    unknownCosts: 'reports.dq.unknown_costs',
    groupMembershipCurrentOnly: 'reports.dq.group_membership_as_of_generation',
    entryDateProxy: 'reports.dq.entry_date_created_at_proxy',
    noExpectedData: 'reports.dq.no_expected_data',
    scopeEmpty: 'reports.dq.scope_empty',
};
function buildCoverage(expected, recorded) {
    if (typeof expected === 'number' && typeof recorded === 'number') {
        return { expected: Math.max(0, expected), recorded: Math.max(0, recorded) };
    }
    if (typeof expected === 'number' || typeof recorded === 'number') {
        throw new TypeError('buildCoverage: pass both counts or both collections');
    }
    const exp = new Set(expected);
    const rec = new Set(recorded);
    let n = 0;
    for (const k of rec)
        if (exp.has(k))
            n++;
    return { expected: exp.size, recorded: n };
}
function coverageRatio(c) {
    if (c.expected <= 0)
        return null;
    return Math.min(1, c.recorded / c.expected);
}
function isIncompleteCoverage(c) {
    return c.expected > 0 && c.recorded < c.expected;
}
function missingKeys(expected, recorded) {
    const rec = new Set(recorded);
    return Array.from(new Set(expected)).filter((k) => !rec.has(k));
}
function valueOrMissing(amount, unit, reason) {
    if (typeof amount !== 'number' || !Number.isFinite(amount))
        return { state: 'missing', reason };
    return { state: 'value', value: amount, unit };
}
function buildDataQuality(input) {
    const flags = {
        incompleteCoverage: isIncompleteCoverage(input.coverage),
        hasUnsubmittedDrafts: !!input.hasUnsubmittedDrafts,
        hasEstimatedValues: !!input.hasEstimatedValues || !!input.usesCreatedAtProxy,
        hasUnknownCosts: !!input.hasUnknownCosts,
        groupMembershipCurrentOnly: !!input.groupMembershipCurrentOnly,
    };
    const notes = [];
    if (input.scopeEmpty)
        notes.push(exports.DQ_NOTE.scopeEmpty);
    else if (input.coverage.expected <= 0)
        notes.push(exports.DQ_NOTE.noExpectedData);
    if (flags.incompleteCoverage)
        notes.push(exports.DQ_NOTE.incompleteCoverage);
    if (flags.hasUnsubmittedDrafts)
        notes.push(exports.DQ_NOTE.unsubmittedDrafts);
    if (input.usesCreatedAtProxy)
        notes.push(exports.DQ_NOTE.entryDateProxy);
    if (input.hasEstimatedValues)
        notes.push(exports.DQ_NOTE.estimatedValues);
    if (flags.hasUnknownCosts)
        notes.push(exports.DQ_NOTE.unknownCosts);
    if (flags.groupMembershipCurrentOnly)
        notes.push(exports.DQ_NOTE.groupMembershipCurrentOnly);
    return { coverage: input.coverage, notes, flags };
}
//# sourceMappingURL=data-quality.js.map