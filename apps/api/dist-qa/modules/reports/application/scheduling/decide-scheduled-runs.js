"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULED_TYPES = void 0;
exports.decideScheduledRuns = decideScheduledRuns;
exports.withinFinalizationWindow = withinFinalizationWindow;
const job_key_1 = require("../../domain/contracts/job-key");
const period_1 = require("../../domain/period");
const scheduling_constants_1 = require("./scheduling.constants");
exports.SCHEDULED_TYPES = ['WEEKLY', 'MONTHLY'];
function decideScheduledRuns(input) {
    const { farmId, now, farmTimezone, farmCreatedAt, templates } = input;
    const window = input.catchUpPeriods ?? scheduling_constants_1.SCHEDULE_CATCH_UP_PERIODS;
    const due = [];
    const missedCandidates = [];
    for (const type of exports.SCHEDULED_TYPES) {
        const template = templates[type];
        if (!template)
            continue;
        let period = (0, period_1.closedPeriodFor)(type, now, farmTimezone);
        for (let i = 0; i <= window; i += 1) {
            const existedDuring = new Date(period.end).getTime() > farmCreatedAt.getTime();
            if (!existedDuring)
                break;
            if (i < window) {
                const runInstant = (0, period_1.scheduledRunInstant)(period, farmTimezone);
                if (runInstant.getTime() <= now.getTime()) {
                    due.push({
                        type,
                        period,
                        runInstant,
                        templateVersion: template.version,
                        scheduledKey: (0, job_key_1.scheduledReportKey)({
                            farmId,
                            type,
                            periodStartDate: period.startDate,
                            templateVersion: template.version,
                        }),
                    });
                }
            }
            else {
                missedCandidates.push({ type, periodStartDate: period.startDate });
            }
            period = (0, period_1.previousEquivalentPeriod)(period, now).previous;
        }
    }
    return { due, missedCandidates };
}
function withinFinalizationWindow(now, runInstant, maxWaitHours) {
    const hours = typeof maxWaitHours === 'number' &&
        Number.isFinite(maxWaitHours) &&
        maxWaitHours > 0
        ? maxWaitHours
        : 0;
    return now.getTime() < runInstant.getTime() + hours * scheduling_constants_1.HOUR_MS;
}
//# sourceMappingURL=decide-scheduled-runs.js.map