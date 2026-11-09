"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortFacts = sortFacts;
exports.foldReproduction = foldReproduction;
const pregnancy_estimate_1 = require("./pregnancy-estimate");
const RANK = {
    BREEDING: 0,
    HEAT: 1,
    PREG_CHECK: 2,
    CALVING: 3,
    ABORTION: 4,
};
function sortFacts(facts) {
    return [...facts].sort((a, b) => a.at.getTime() - b.at.getTime() ||
        RANK[a.type] - RANK[b.type] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function withinWindow(breeding, check) {
    if (!breeding)
        return null;
    const days = (check.getTime() - breeding.getTime()) / 86400000;
    return days >= 0 && days <= 150 ? breeding : null;
}
function foldReproduction(facts) {
    let pregnancy = null;
    let pending = null;
    let lastBreedingAt = null;
    let lastPregnantBreedingAt = null;
    let lastCalvingAt = null;
    let lastCheckAt = null;
    let lastAbortionAt = null;
    for (const f of sortFacts(facts)) {
        switch (f.type) {
            case 'BREEDING':
                lastBreedingAt = f.at;
                if (f.endedInPregnancy)
                    lastPregnantBreedingAt = f.at;
                pending =
                    f.open !== false
                        ? { id: f.id, at: f.at, historical: f.provenance === 'HISTORICAL' }
                        : null;
                break;
            case 'PREG_CHECK':
                lastCheckAt = f.at;
                if (f.result === 'PREGNANT' || f.result === undefined) {
                    const est = (0, pregnancy_estimate_1.estimatePregnancyDates)({
                        diagnosisDate: f.at,
                        breedingDate: f.breedingDate ??
                            pending?.at ??
                            withinWindow(lastPregnantBreedingAt, f.at),
                        gestationDay: f.gestationDay,
                        expectedCalvingDate: f.expectedCalvingDate,
                    });
                    pregnancy = {
                        checkedAt: f.at,
                        conceptionDate: est.conceptionDate,
                        confidence: est.confidence,
                        expectedCalvingDate: f.expectedCalvingDate ?? est.calculatedCalvingDate,
                        historical: f.provenance === 'HISTORICAL',
                    };
                    pending = null;
                }
                else if (f.result === 'NOT_PREGNANT') {
                    pregnancy = null;
                    pending = null;
                }
                break;
            case 'CALVING':
                lastCalvingAt = f.at;
                pregnancy = null;
                pending = null;
                break;
            case 'ABORTION':
                lastAbortionAt = f.at;
                pregnancy = null;
                pending = null;
                break;
            default:
                break;
        }
    }
    return {
        hasActivePregnancy: pregnancy !== null,
        pregnancy,
        pendingBreeding: pending,
        lastBreedingAt,
        lastCalvingAt,
        lastCheckAt,
        lastAbortionAt,
    };
}
//# sourceMappingURL=reproduction-fold.js.map