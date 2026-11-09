"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBcsAlerts = computeBcsAlerts;
const cattle_constants_1 = require("./cattle.constants");
const DAY_MS = 1000 * 60 * 60 * 24;
const round = (value) => Math.round(value * 100) / 100;
function computeBcsAlerts(input) {
    const alerts = [];
    const { score, recordedDate, expectedCalvingDate, priorScore } = input;
    if (expectedCalvingDate) {
        const daysToCalving = Math.round((expectedCalvingDate.getTime() - recordedDate.getTime()) / DAY_MS);
        if (Math.abs(daysToCalving) <= cattle_constants_1.BCS_NEAR_CALVING_WINDOW_DAYS) {
            if (score < cattle_constants_1.BCS_NEAR_CALVING_LOW) {
                alerts.push({
                    level: 'orange',
                    code: 'bcs_low_near_calving',
                    message: `BCS ${score} is below ${cattle_constants_1.BCS_NEAR_CALVING_LOW} within 3 weeks of calving.`,
                });
            }
            else if (score > cattle_constants_1.BCS_NEAR_CALVING_HIGH) {
                alerts.push({
                    level: 'orange',
                    code: 'bcs_high_near_calving',
                    message: `BCS ${score} is above ${cattle_constants_1.BCS_NEAR_CALVING_HIGH} within 3 weeks of calving (milk-fever risk).`,
                });
            }
        }
    }
    if (priorScore !== null &&
        priorScore !== undefined &&
        priorScore - score > cattle_constants_1.BCS_DROP_THRESHOLD) {
        alerts.push({
            level: 'yellow',
            code: 'bcs_excessive_drop',
            message: `BCS dropped ${round(priorScore - score)} points in under ${cattle_constants_1.BCS_DROP_WINDOW_DAYS} days (excessive mobilization).`,
        });
    }
    return alerts;
}
//# sourceMappingURL=bcs-alerts.js.map