"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveLactationStage = deriveLactationStage;
const DAY_MS = 24 * 60 * 60 * 1000;
function deriveLactationStage(input) {
    const { now, lactationStartDate, isInActiveDryPeriod, farmSettings } = input;
    if (isInActiveDryPeriod) {
        return 'DRY_PERIOD';
    }
    if (!lactationStartDate) {
        return null;
    }
    const daysInMilk = Math.floor((now.getTime() - lactationStartDate.getTime()) / DAY_MS);
    if (daysInMilk <= farmSettings.freshDays) {
        return 'FRESH';
    }
    if (daysInMilk <= farmSettings.earlyDays) {
        return 'EARLY';
    }
    if (daysInMilk <= farmSettings.midDays) {
        return 'MID';
    }
    return 'LATE';
}
//# sourceMappingURL=lactation-stage.js.map