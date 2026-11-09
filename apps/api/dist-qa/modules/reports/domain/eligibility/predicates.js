"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyBreedingStatus = classifyBreedingStatus;
exports.isReproductionEligible = isReproductionEligible;
exports.isMilkEligibleRow = isMilkEligibleRow;
exports.hasUnsubmittedDrafts = hasUnsubmittedDrafts;
function classifyBreedingStatus(status) {
    switch (status) {
        case 'PREGNANT':
        case 'CALVED':
            return 'confirmed';
        case 'PENDING_CHECK':
            return 'pending';
        case 'FAILED':
            return 'failed';
        case 'RETURNED_TO_HEAT':
        case 'ABORTED':
            return 'other';
        case 'VOIDED':
            return 'excluded';
    }
}
function isReproductionEligible(row) {
    return !row.voidedAt && classifyBreedingStatus(row.status) !== 'excluded';
}
function isMilkEligibleRow(row) {
    return (row.submitted === true &&
        typeof row.yieldL === 'number' &&
        Number.isFinite(row.yieldL) &&
        row.yieldL >= 0);
}
function hasUnsubmittedDrafts(rows) {
    return rows.some((r) => r.submitted !== true);
}
//# sourceMappingURL=predicates.js.map