"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEALTH_DEFINITIONS = void 0;
const NO_COWS = 'No cows in scope for the period: not_applicable, never 0.';
const SCOPE = 'Cows in ctx.cattleIds (in scope and present in the period); HealthCase/HealthTask soft-deleted rows excluded.';
const def = (id, unit, formula, eligibilityRule = SCOPE, extra = {}) => ({
    id,
    domain: 'health',
    unit,
    formula,
    eligibilityRule,
    missingDataRule: NO_COWS,
    calcVersion: 1,
    ...extra,
});
exports.HEALTH_DEFINITIONS = [
    def('health.cases_opened', 'cases', 'EVENT count of CURATIVE HealthCases with startDate in [period.start, period.end). A cow with two cases counts twice.'),
    def('health.cows_with_cases_opened', 'cows', 'UNIQUE cows: distinct cattleId among the cases counted by health.cases_opened.'),
    def('health.treatments_given', 'treatments', 'EVENT count of TreatmentLogs with administeredAt in the period and voidedAt null.'),
    def('health.cows_treated', 'cows', 'UNIQUE cows: distinct cattleId among non-voided TreatmentLogs administered in the period.'),
    def('health.cases_closed', 'cases', 'CURATIVE cases with status RECOVERED, MORTALITY or CLOSED and closedDate in the period.'),
    def('health.cases_recovered', 'cases', 'CURATIVE cases with status RECOVERED and closedDate in the period.'),
    def('health.cases_mortality', 'cases', 'CURATIVE cases with status MORTALITY and closedDate in the period.'),
    def('health.cases_open_at_period_end', 'cases', 'CURATIVE cases started before period.end and not closed by then (closedDate null/after end and status not closed). Point-in-time: no previous-period comparison.'),
    def('health.preventive_tasks_completed', 'tasks', 'Preventive-round HealthTasks (planEnrollmentId set) with status COMPLETED and completedAt in the period.'),
    def('health.preventive_tasks_missed', 'tasks', 'Preventive-round HealthTasks (planEnrollmentId set) with stored status MISSED and dueDateTime in the period. A still-open task past due is overdue, not missed.'),
    def('health.tasks_overdue', 'tasks', 'HealthTasks with status in (PENDING, RESCHEDULED, OVERDUE) AND dueDateTime < generatedAt. DERIVED from dueDateTime, not the stored status (nothing writes OVERDUE). RESCHEDULED is included because it is a live status with a new dueDateTime, following LIVE_TASK_STATUSES in health-reminder.service.ts. Point-in-time: no comparison.'),
    def('health.cases_repeated', 'cases', 'Cases opened in the period for which the same cow had a previous case of the same condition that closed at most ctx.thresholds.repeatedCaseWindowDays before this one started (exactly the window counts). Cases with a null condition are never matched.'),
    def('health.withdrawals_active', 'withdrawals', 'SafetyWithdrawals with status ACTIVE or READY_FOR_RELEASE at generation (matches the Healthcare safety-withdrawals activeOnly view; RELEASED and CANCELLED excluded). Point-in-time: no comparison.'),
    def('health.treatment_cost', 'BDT', 'Sum of non-voided Expense amounts linked by TreatmentLog.financeTransactionId, over non-voided treatments administered in the period. Vet fees (vetExpenseId) are not included. Finance-gated: not computed and absent from output when finance is excluded.', SCOPE, { requiresPermission: 'finance.read' }),
    def('health.vet_fees', 'BDT', 'Sum of TreatmentLog.vetCost over non-voided treatments administered in the period (source vet_fee). Reported separately from health.treatment_cost, never merged. No double counting: the vet fee posts its own Expense (vetExpenseId); a row whose vetExpenseId equals its financeTransactionId is the same Expense already in treatment_cost and is skipped. Finance-gated: not computed and absent from output when finance is excluded.', SCOPE, { requiresPermission: 'finance.read' }),
];
//# sourceMappingURL=health-definitions.js.map