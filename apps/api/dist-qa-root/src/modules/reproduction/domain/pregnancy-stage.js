"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePregnancyStage = derivePregnancyStage;
const DAY_MS = 24 * 60 * 60 * 1000;
function derivePregnancyStage(input) {
    const { now, conceptionDate, farmSettings } = input;
    if (!conceptionDate) {
        return null;
    }
    const daysPregnant = Math.floor((now.getTime() - conceptionDate.getTime()) / DAY_MS);
    const expectedCalvingDate = new Date(conceptionDate.getTime() + farmSettings.gestationDays * DAY_MS);
    const closeUpCutoff = new Date(expectedCalvingDate.getTime() - farmSettings.closeUpWindowDays * DAY_MS);
    if (now >= closeUpCutoff) {
        return 'CLOSE_UP';
    }
    if (daysPregnant <= farmSettings.earlyDays) {
        return 'EARLY';
    }
    if (daysPregnant <= farmSettings.midDays) {
        return 'MID';
    }
    return 'LATE';
}
//# sourceMappingURL=pregnancy-stage.js.map