"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESTIMATE_GESTATION_DAYS = void 0;
exports.estimatePregnancyDates = estimatePregnancyDates;
exports.ESTIMATE_GESTATION_DAYS = 280;
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
function estimatePregnancyDates(input) {
    let conceptionDate;
    let source;
    if (input.breedingDate) {
        conceptionDate = input.breedingDate;
        source = 'BREEDING';
    }
    else if (input.gestationDay != null && input.gestationDay > 0) {
        conceptionDate = addDays(input.diagnosisDate, -input.gestationDay);
        source = 'GESTATION_DAY';
    }
    else if (input.expectedCalvingDate) {
        conceptionDate = addDays(input.expectedCalvingDate, -exports.ESTIMATE_GESTATION_DAYS);
        source = 'EXPECTED_CALVING';
    }
    else {
        conceptionDate = null;
        source = 'FALLBACK';
    }
    return {
        conceptionDate,
        calculatedCalvingDate: conceptionDate
            ? addDays(conceptionDate, exports.ESTIMATE_GESTATION_DAYS)
            : null,
        source,
        confidence: source === 'BREEDING'
            ? 'RECORDED'
            : source === 'FALLBACK'
                ? 'UNKNOWN'
                : 'ESTIMATED',
    };
}
//# sourceMappingURL=pregnancy-estimate.js.map