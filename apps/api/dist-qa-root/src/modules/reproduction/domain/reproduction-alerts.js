"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveReproductionAlerts = deriveReproductionAlerts;
const client_1 = require("@prisma/client");
const DAY_MS = 24 * 60 * 60 * 1000;
function deriveReproductionAlerts(input) {
    const { now, reproductionState, recentHeat, heatWindowDays, lastBreeding, currentPregnancy, closeUpWindowDays, overdueCheckDays, calvingOverdueDays, breedingsSinceLastSuccess, repeatBreederThreshold, daysOpen, longDaysOpenThresholdDays, totalAbortions, hasReproductiveHold, } = input;
    const alerts = [];
    if (recentHeat) {
        const heatCutoff = new Date(now.getTime() - heatWindowDays * DAY_MS);
        if (recentHeat.heatDateTime >= heatCutoff) {
            alerts.push('HEAT_DETECTED');
            if (reproductionState === 'PREGNANT') {
                alerts.push('HEAT_ON_ACTIVE_PREGNANCY');
            }
        }
    }
    if (lastBreeding?.status === client_1.BreedingStatus.PENDING_CHECK) {
        const dueDate = lastBreeding.expectedPregnancyCheckDate;
        if (dueDate && now > dueDate) {
            alerts.push('PREGNANCY_CHECK_DUE');
            const overdueCutoff = new Date(dueDate.getTime() + overdueCheckDays * DAY_MS);
            if (now > overdueCutoff) {
                alerts.push('OVERDUE_PREGNANCY_CHECK');
            }
        }
    }
    if (reproductionState !== 'PREGNANT' &&
        breedingsSinceLastSuccess >= repeatBreederThreshold) {
        alerts.push('REPEAT_BREEDER');
    }
    if ((reproductionState === 'OPEN' ||
        reproductionState === 'POSTPARTUM_WAITING') &&
        daysOpen !== null &&
        daysOpen >= longDaysOpenThresholdDays) {
        alerts.push('LONG_DAYS_OPEN');
    }
    if (reproductionState === 'PREGNANT' &&
        currentPregnancy?.expectedCalvingDate) {
        const closeUpCutoff = new Date(currentPregnancy.expectedCalvingDate.getTime() -
            closeUpWindowDays * DAY_MS);
        if (now >= closeUpCutoff) {
            alerts.push('CALVING_DUE');
        }
        const calvingOverdueCutoff = new Date(currentPregnancy.expectedCalvingDate.getTime() +
            calvingOverdueDays * DAY_MS);
        if (now > calvingOverdueCutoff) {
            alerts.push('CALVING_OVERDUE');
        }
    }
    if (totalAbortions > 0) {
        alerts.push('ABORTION_HISTORY');
    }
    if (hasReproductiveHold) {
        alerts.push('REPRODUCTIVE_HOLD');
    }
    return alerts;
}
//# sourceMappingURL=reproduction-alerts.js.map