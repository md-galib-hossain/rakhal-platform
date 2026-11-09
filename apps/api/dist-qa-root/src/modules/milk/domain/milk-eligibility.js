"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveMilkEligibility = deriveMilkEligibility;
function deriveMilkEligibility({ isWithheld, isInColostrumWindow, hasDiscardRequiredHold, }) {
    const reasons = [];
    if (hasDiscardRequiredHold)
        reasons.push('OTHER');
    if (isWithheld)
        reasons.push('MEDICINE_WITHDRAWAL');
    if (isInColostrumWindow)
        reasons.push('COLOSTRUM_PERIOD');
    let primaryStatus;
    if (hasDiscardRequiredHold) {
        primaryStatus = 'DISCARD_REQUIRED';
    }
    else if (isWithheld) {
        primaryStatus = 'WITHHELD';
    }
    else if (isInColostrumWindow) {
        primaryStatus = 'COLOSTRUM';
    }
    else {
        primaryStatus = 'SALEABLE';
    }
    return {
        isSaleable: primaryStatus === 'SALEABLE',
        primaryStatus,
        reasons,
    };
}
//# sourceMappingURL=milk-eligibility.js.map