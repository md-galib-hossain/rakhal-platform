"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const txn_filters_1 = require("src/common/finance/txn-filters");
const runway_1 = require("src/common/finance/runway");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const notification_scheduler_service_1 = require("src/modules/notification/application/services/notification-scheduler.service");
const overdue_nag_service_1 = require("./overdue-nag.service");
const subscription_lifecycle_service_1 = require("src/modules/subscription/application/services/subscription-lifecycle.service");
const renewal_reminder_service_1 = require("src/modules/renewal/application/services/renewal-reminder.service");
const reconciliation_service_1 = require("src/modules/billing/application/services/reconciliation.service");
const balance_service_1 = require("src/modules/finance-v2/accounts/application/balance.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const health_service_1 = require("src/modules/health/application/services/health.service");
const health_reminder_service_1 = require("src/modules/health/application/services/health-reminder.service");
const health_cycle_service_1 = require("src/modules/health/application/services/health-cycle.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const follow_up_reminder_service_1 = require("src/modules/animal-events/application/services/follow-up-reminder.service");
const feed_plan_fit_sweep_service_1 = require("src/modules/feed/application/services/feed-plan-fit-sweep.service");
const milk_anomaly_1 = require("src/modules/milk/domain/milk-anomaly");
const lactation_curve_1 = require("src/modules/reproduction/domain/lactation-curve");
const lactation_yield_1 = require("src/modules/reproduction/domain/lactation-yield");
const lactation_alerts_1 = require("src/modules/reproduction/domain/lactation-alerts");
const DAY_MS = 24 * 60 * 60 * 1000;
const BOSSES = ['Owner', 'Manager'];
const LACTATION_ALERT_WINDOW_DAYS = 8;
let SchedulerService = SchedulerService_1 = class SchedulerService {
    prisma;
    notifications;
    subscriptionLifecycle;
    renewalReminders;
    reconciliation;
    balance;
    farmSettings;
    healthService;
    taskService;
    feedFitSweep;
    healthReminders;
    healthCycles;
    followUpReminders;
    farmClock;
    notificationScheduler;
    overdueNag;
    log;
    constructor(prisma, notifications, subscriptionLifecycle, renewalReminders, reconciliation, balance, farmSettings, healthService, taskService, feedFitSweep, healthReminders, healthCycles, followUpReminders, farmClock, notificationScheduler, overdueNag, logger) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.subscriptionLifecycle = subscriptionLifecycle;
        this.renewalReminders = renewalReminders;
        this.reconciliation = reconciliation;
        this.balance = balance;
        this.farmSettings = farmSettings;
        this.healthService = healthService;
        this.taskService = taskService;
        this.feedFitSweep = feedFitSweep;
        this.healthReminders = healthReminders;
        this.healthCycles = healthCycles;
        this.followUpReminders = followUpReminders;
        this.farmClock = farmClock;
        this.notificationScheduler = notificationScheduler;
        this.overdueNag = overdueNag;
        this.log = logger.setContext(SchedulerService_1.name);
    }
    async runDailySweeps() {
        const results = {};
        for (const [name, sweep] of [
            [
                'notification_schedule_reconcile',
                () => this.sweepNotificationReconcile(),
            ],
            ['payment_overdue', () => this.sweepPaymentOverdue()],
            ['task_overdue', () => this.sweepTasksOverdue()],
            ['medicine_expiring_30_days', () => this.sweepMedicineExpiring()],
            [
                'follow_up_and_reminder_due',
                () => (this.v2On ? 0 : this.followUpReminders.sweepAll()),
            ],
            ['supplier_payment_due_soon', () => this.sweepSupplierPaymentDue()],
            ['survival_runway_warning', () => this.sweepSurvivalRunwayWarning()],
            ['semen_tank_low_ln2', () => this.sweepSemenTankLowLn2()],
            ['todays_tasks_ready', () => this.sweepTodaysTasksReady()],
            ['morbidity_outbreak', () => this.sweepMorbidityOutbreak()],
            ['subscription_expiry', () => this.sweepSubscriptionExpiry()],
            ['renewal_reminders', () => this.sweepRenewalReminders()],
            ['settlement_reconciliation', () => this.sweepReconciliation()],
            [
                'safety_withdrawals_ready_for_release',
                () => this.sweepSafetyWithdrawalsReadyForRelease(),
            ],
            ['lactation_alerts', () => this.sweepLactationAlerts()],
            ['feed_plan_fit', () => this.feedFitSweep.sweepAll()],
            [
                'health_task_reminders',
                () => (this.v2On ? 0 : this.healthReminders.sweepAll()),
            ],
            ['health_cycle_repeat', () => this.healthCycles.sweepAll()],
            ['overdue_nag', () => this.overdueNag.sweepAll()],
        ]) {
            try {
                results[name] = await sweep();
            }
            catch (err) {
                results[name] = -1;
                this.log.error(`Sweep "${name}" failed`, err);
            }
        }
        this.log.info('Daily notification sweeps complete', results);
        return results;
    }
    get v2On() {
        return this.notificationScheduler.enabled;
    }
    async sweepNotificationReconcile() {
        if (!this.v2On)
            return 0;
        const r = await this.notificationScheduler.reconcile(new Date(), {
            purge: true,
        });
        return r.enqueued + r.removed + r.advanced + r.purged;
    }
    async sweepPaymentOverdue() {
        return this.sweepPaymentOverdueV2();
    }
    async sweepPaymentOverdueV2() {
        const now = new Date();
        const overdue = await this.prisma.receivable.findMany({
            where: { dueDate: { lt: now }, closedAt: null },
            select: {
                id: true,
                farmId: true,
                totalAmount: true,
                dueDate: true,
                sale: { select: { saleNumber: true } },
            },
        });
        if (overdue.length === 0)
            return 0;
        const sums = await this.prisma.paymentAllocation.groupBy({
            by: ['receivableId'],
            where: { receivableId: { in: overdue.map((r) => r.id) } },
            _sum: { amount: true },
        });
        const allocatedById = new Map(sums.map((s) => [s.receivableId, s._sum.amount ?? 0]));
        let emitted = 0;
        for (const r of overdue) {
            const outstanding = (0, txn_filters_1.deriveOutstanding)(r.totalAmount, allocatedById.get(r.id) ?? 0);
            if (outstanding <= 0)
                continue;
            emitted += await this.emit({
                farmId: r.farmId,
                eventKey: 'payment_overdue',
                title: 'Payment Overdue',
                message: `${r.sale.saleNumber} is overdue: ৳${outstanding} (due ${this.ymd(r.dueDate)}).`,
                params: {
                    entityName: r.sale.saleNumber,
                    amount: outstanding,
                    date: this.ymd(r.dueDate),
                },
                link: '/finance/receivables',
                dedupeKey: `payment_overdue:${r.id}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepTasksOverdue() {
        const now = new Date();
        const tasks = await this.prisma.task.findMany({
            where: {
                dueAt: { lt: now },
                status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
                ruleKey: null,
                ...(this.v2On ? {} : { kind: { not: 'REMINDER' } }),
            },
            select: { id: true, farmId: true, name: true, dueAt: true },
        });
        let emitted = 0;
        for (const t of tasks) {
            emitted += await this.emit({
                farmId: t.farmId,
                eventKey: 'task_overdue',
                title: 'Task Overdue',
                message: `"${t.name}" was due ${this.ymd(t.dueAt)} and is not complete.`,
                params: { name: t.name, date: this.ymd(t.dueAt) },
                link: '/tasks',
                dedupeKey: `task_overdue:${t.id}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepMedicineExpiring() {
        const now = new Date();
        const horizon = new Date(now.getTime() + 30 * DAY_MS);
        const meds = await this.prisma.medicine.findMany({
            where: {
                deletedAt: null,
                currentStock: { gt: 0 },
                expiryDate: { gte: now, lte: horizon },
            },
            select: { id: true, farmId: true, name: true, expiryDate: true },
        });
        let emitted = 0;
        for (const m of meds) {
            emitted += await this.emit({
                farmId: m.farmId,
                eventKey: 'medicine_expiring_30_days',
                title: 'Medicine Expiring in 30 Days',
                message: `${m.name} expires on ${this.ymd(m.expiryDate)}.`,
                params: { name: m.name, date: this.ymd(m.expiryDate) },
                link: '/inventory/medicine',
                dedupeKey: `medicine_expiring_30_days:${m.id}`,
            });
        }
        return emitted;
    }
    async sweepSupplierPaymentDue() {
        return this.sweepSupplierPaymentDueV2();
    }
    async sweepSupplierPaymentDueV2() {
        const now = new Date();
        const horizon = new Date(now.getTime() + 3 * DAY_MS);
        const payables = await this.prisma.payable.findMany({
            where: { dueDate: { gte: now, lte: horizon }, closedAt: null },
            select: {
                id: true,
                farmId: true,
                totalAmount: true,
                dueDate: true,
                purchase: { select: { purchaseNumber: true } },
                expense: { select: { description: true } },
            },
        });
        if (payables.length === 0)
            return 0;
        const sums = await this.prisma.paymentAllocation.groupBy({
            by: ['payableId'],
            where: { payableId: { in: payables.map((p) => p.id) } },
            _sum: { amount: true },
        });
        const allocatedById = new Map(sums.map((s) => [s.payableId, s._sum.amount ?? 0]));
        let emitted = 0;
        for (const p of payables) {
            const outstanding = (0, txn_filters_1.deriveOutstanding)(p.totalAmount, allocatedById.get(p.id) ?? 0);
            if (outstanding <= 0)
                continue;
            const entityName = p.purchase?.purchaseNumber ?? p.expense?.description ?? 'A payable';
            emitted += await this.emit({
                farmId: p.farmId,
                eventKey: 'supplier_payment_due_soon',
                title: 'Supplier Payment Due Soon',
                message: `${entityName} is due soon: ৳${outstanding} (due ${this.ymd(p.dueDate)}).`,
                params: {
                    entityName,
                    amount: outstanding,
                    date: this.ymd(p.dueDate),
                },
                link: '/finance',
                dedupeKey: `supplier_payment_due_soon:${p.id}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepSurvivalRunwayWarning() {
        const now = new Date();
        const farms = await this.prisma.farm.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { id: true },
        });
        let emitted = 0;
        for (const f of farms) {
            const [rakhalBalance, thresholds] = await Promise.all([
                this.balance.getRakhalBalance(f.id),
                this.farmSettings.financeRunwayThresholds(f.id),
            ]);
            const snapshot = await (0, runway_1.computeRunwaySnapshot)(this.prisma, f.id, Number(rakhalBalance.rakhalBalance), thresholds, now);
            if (snapshot.status !== 'warning' && snapshot.status !== 'critical')
                continue;
            emitted += await this.emit({
                farmId: f.id,
                eventKey: 'survival_runway_warning',
                title: 'Survival Runway Warning',
                message: `Cash runway is ${snapshot.status} — about ${snapshot.days ?? 0} day(s) left at current spend.`,
                params: { status: snapshot.status, days: snapshot.days ?? 0 },
                link: '/finance',
                dedupeKey: `survival_runway_warning:${f.id}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepSemenTankLowLn2() {
        const now = new Date();
        const tanks = await this.prisma.semenTank.findMany({
            where: { deletedAt: null, ln2LevelPct: { lt: 30 } },
            select: { id: true, farmId: true, name: true, ln2LevelPct: true },
        });
        let emitted = 0;
        for (const t of tanks) {
            emitted += await this.emit({
                farmId: t.farmId,
                eventKey: 'semen_tank_low_ln2',
                title: 'Semen Tank Low LN2',
                message: `${t.name}'s LN2 level is low (${t.ln2LevelPct}%).`,
                params: { name: t.name, level: t.ln2LevelPct ?? 0 },
                link: '/inventory',
                dedupeKey: `semen_tank_low_ln2:${t.id}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepTodaysTasksReady() {
        const now = new Date();
        const tasks = await this.prisma.task.findMany({
            where: {
                ...(this.v2On ? {} : { kind: 'TASK' }),
                dueAt: {
                    gte: new Date(now.getTime() - 2 * DAY_MS),
                    lt: new Date(now.getTime() + 2 * DAY_MS),
                },
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                assignedToId: { not: null },
            },
            select: { farmId: true, assignedToId: true, dueAt: true },
        });
        const tzByFarm = new Map();
        const byUser = new Map();
        for (const t of tasks) {
            if (!t.assignedToId || !t.dueAt)
                continue;
            let tz = tzByFarm.get(t.farmId);
            if (!tz) {
                tz = await this.farmClock.timezone(t.farmId);
                tzByFarm.set(t.farmId, tz);
            }
            const today = (0, farm_time_1.localDateIso)(tz, now);
            if ((0, farm_time_1.localDateIso)(tz, t.dueAt) !== today)
                continue;
            const entry = byUser.get(t.assignedToId) ?? {
                farmId: t.farmId,
                count: 0,
                today,
            };
            entry.count += 1;
            byUser.set(t.assignedToId, entry);
        }
        let emitted = 0;
        for (const [userId, { farmId, count, today }] of byUser) {
            const created = await this.notifications.notifyUsers({
                farmId,
                userIds: [userId],
                eventKey: 'todays_tasks_ready',
                title: "Today's Tasks Ready",
                message: `You have ${count} task(s) due today.`,
                params: { count },
                link: '/tasks',
                dedupeKey: `todays_tasks_ready:${userId}:${today}`,
            });
            emitted += created.length;
        }
        return emitted;
    }
    async sweepMorbidityOutbreak() {
        const now = new Date();
        const since = new Date(now.getTime() - 2 * DAY_MS);
        const sickCounts = await this.prisma.healthCase.groupBy({
            by: ['farmId'],
            where: {
                deletedAt: null,
                status: { in: ['ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE'] },
                startDate: { gte: since },
                cattle: { herdStatus: 'ACTIVE', deletedAt: null },
            },
            _count: { _all: true },
        });
        let emitted = 0;
        for (const row of sickCounts) {
            const herdSize = await this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(row.farmId),
            });
            if (herdSize === 0)
                continue;
            const rate = row._count._all / herdSize;
            if (rate <= 0.05)
                continue;
            emitted += await this.emit({
                farmId: row.farmId,
                eventKey: 'morbidity_outbreak',
                title: 'Morbidity Outbreak Alert',
                message: `${row._count._all} of ${herdSize} animals (${Math.round(rate * 100)}%) reported sick in the last 48 hours.`,
                params: {
                    sick: row._count._all,
                    herd: herdSize,
                    pct: Math.round(rate * 100),
                },
                link: '/healthcare',
                dedupeKey: `morbidity_outbreak:${row.farmId}:${this.ymd(now)}`,
            });
        }
        return emitted;
    }
    async sweepSubscriptionExpiry() {
        const { pastDue, expired } = await this.subscriptionLifecycle.runExpirySweep();
        return pastDue + expired;
    }
    async sweepRenewalReminders() {
        const { preExpiry, winback } = await this.renewalReminders.runRenewalSweep();
        return preExpiry + winback;
    }
    async sweepReconciliation() {
        const { flagged } = await this.reconciliation.runReconciliation();
        return flagged;
    }
    async sweepSafetyWithdrawalsReadyForRelease() {
        const { updated } = await this.healthService.sweepWithdrawalsReadyForRelease();
        return updated;
    }
    async sweepLactationAlerts() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - DAY_MS);
        const windowStart = new Date(now.getTime() - LACTATION_ALERT_WINDOW_DAYS * DAY_MS);
        const lactations = await this.prisma.lactation.findMany({
            where: {
                status: 'ACTIVE',
                cattle: { herdStatus: 'ACTIVE', deletedAt: null },
            },
            select: {
                id: true,
                cattleId: true,
                startDate: true,
                recommendedDryOffAt: true,
                plannedDryOffAt: true,
                peakMilkYield: true,
                cattle: { select: { farmId: true, tagNumber: true, name: true } },
            },
        });
        const sessionsCache = new Map();
        let created = 0;
        for (const l of lactations) {
            const farmId = l.cattle.farmId;
            const label = l.cattle.name ?? l.cattle.tagNumber;
            const tagNumber = l.cattle.tagNumber;
            let expectedSessions = sessionsCache.get(farmId);
            if (!expectedSessions) {
                const configured = await this.farmSettings.milkActiveSessions(farmId);
                expectedSessions =
                    configured.length > 0 ? configured : milk_anomaly_1.DEFAULT_SESSION_CONFIG;
                sessionsCache.set(farmId, expectedSessions);
            }
            const entries = await this.prisma.milkLogEntry.findMany({
                where: {
                    cattleId: l.cattleId,
                    logDate: { gte: windowStart, lte: yesterday },
                },
                select: { logDate: true, session: true, yieldL: true },
            });
            const series = (0, lactation_curve_1.buildDailyYieldSeries)({
                startDate: windowStart,
                endDate: yesterday,
                entries,
                expectedSessions,
            });
            if (series.length === 0)
                continue;
            const evalPoint = series[series.length - 1];
            const baseline = series.slice(0, -1);
            const currentDim = (0, lactation_yield_1.daysBetween)(l.startDate, now);
            if ((0, lactation_alerts_1.detectMissingSession)({ dataQuality: evalPoint.dataQuality })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: `MISSING_SESSION:${evalPoint.date}`,
                    dedupeOpenOnly: false,
                    name: `Missing milk-log session — ${label}`,
                    details: `No milk-log session was recorded for ${label} (${tagNumber}) on ${evalPoint.date}.`,
                    category: client_1.TaskCategory.MILKING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: now,
                });
            }
            if (baseline.length > 0) {
                const baselineAvgYieldL = Math.round((baseline.reduce((sum, p) => sum + p.yieldL, 0) / baseline.length) *
                    100) / 100;
                const dropThresholdPct = await this.farmSettings.lactationSuddenDropThresholdPct(farmId);
                const drop = (0, lactation_alerts_1.detectSuddenDrop)({
                    evaluatedDayYieldL: evalPoint.yieldL,
                    evaluatedDayDataQuality: evalPoint.dataQuality,
                    baselineDaysDataQuality: baseline.map((p) => p.dataQuality),
                    baselineAvgYieldL,
                    dropThresholdPct,
                });
                if (drop.fired) {
                    created += await this.raiseLactationAlertTask({
                        farmId,
                        cattleId: l.cattleId,
                        tag: `SUDDEN_DROP:${evalPoint.date}`,
                        dedupeOpenOnly: false,
                        name: `Sudden milk-yield drop — ${label}`,
                        details: `${label} (${tagNumber}) produced ${evalPoint.yieldL}L on ${evalPoint.date}, a ${drop.dropPct}% drop vs the preceding 7-day average (${baselineAvgYieldL}L).`,
                        category: client_1.TaskCategory.MILKING,
                        priority: client_1.TaskPriority.HIGH,
                        dueAt: now,
                    });
                }
            }
            if ((0, lactation_alerts_1.detectLowPeakByDim)({
                currentDim,
                peakMilkYield: l.peakMilkYield,
                lowPeakByDimDays: lactation_alerts_1.DEFAULT_LOW_PEAK_BY_DIM_DAYS,
                minExpectedPeakYieldL: lactation_alerts_1.DEFAULT_LOW_PEAK_MIN_YIELD_L,
            })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: 'LOW_PEAK_BY_DIM',
                    dedupeOpenOnly: true,
                    name: `Low peak yield by DIM — ${label}`,
                    details: `${label} (${tagNumber}) is at day ${currentDim} of milk without approaching a reasonable peak (recorded peak: ${l.peakMilkYield ?? 'none'} L).`,
                    category: client_1.TaskCategory.MILKING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: now,
                });
            }
            const longLactationDimThresholdDays = await this.farmSettings.lactationLongNotPregnantDimDays(farmId);
            if (currentDim >= longLactationDimThresholdDays) {
                const activePregnancy = await this.prisma.pregnancy.findFirst({
                    where: { cattleId: l.cattleId, status: 'ACTIVE' },
                    select: { id: true },
                });
                if ((0, lactation_alerts_1.detectLongLactationNotPregnant)({
                    currentDim,
                    longLactationDimThresholdDays,
                    hasActivePregnancy: !!activePregnancy,
                })) {
                    created += await this.raiseLactationAlertTask({
                        farmId,
                        cattleId: l.cattleId,
                        tag: 'LONG_LACTATION_NOT_PREGNANT',
                        dedupeOpenOnly: true,
                        name: `Long lactation, not pregnant — ${label}`,
                        details: `${label} (${tagNumber}) is at day ${currentDim} of milk with no active pregnancy on record — dry-off projection is a management estimate only.`,
                        category: client_1.TaskCategory.BREEDING,
                        priority: client_1.TaskPriority.MEDIUM,
                        dueAt: now,
                    });
                }
            }
            if ((0, lactation_alerts_1.detectDryOffApproaching)({
                recommendedDryOffAt: l.recommendedDryOffAt,
                now,
                leadDays: lactation_alerts_1.DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS,
            })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: 'DRY_OFF_APPROACHING',
                    dedupeOpenOnly: true,
                    name: `Dry-off approaching — ${label}`,
                    details: `${label} (${tagNumber}) has a recommended dry-off date of ${this.ymd(l.recommendedDryOffAt)}.`,
                    category: client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: l.recommendedDryOffAt,
                });
            }
            if ((0, lactation_alerts_1.detectPlannedDryOffDue)({ plannedDryOffAt: l.plannedDryOffAt, now })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: `PLANNED_DRY_OFF_DUE:${this.ymd(now)}`,
                    dedupeOpenOnly: false,
                    name: `Planned dry-off due today — ${label}`,
                    details: `${label} (${tagNumber}) is scheduled for dry-off today (${this.ymd(now)}).`,
                    category: client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.HIGH,
                    dueAt: now,
                });
            }
            if ((0, lactation_alerts_1.detectDryOffOverdue)({ recommendedDryOffAt: l.recommendedDryOffAt, now })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: 'DRY_OFF_OVERDUE',
                    dedupeOpenOnly: true,
                    name: `Dry-off overdue — ${label}`,
                    details: `${label} (${tagNumber})'s recommended dry-off date (${this.ymd(l.recommendedDryOffAt)}) has passed with no dry-off recorded.`,
                    category: client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.HIGH,
                    dueAt: now,
                });
            }
            if ((0, lactation_alerts_1.detectLowProductionDryOffReview)({
                recentDailyYieldsL: series.map((p) => p.yieldL),
                thresholdL: lactation_alerts_1.DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L,
                consecutiveDaysRequired: lactation_alerts_1.DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS,
            })) {
                created += await this.raiseLactationAlertTask({
                    farmId,
                    cattleId: l.cattleId,
                    tag: 'LOW_PRODUCTION_DRY_OFF_REVIEW',
                    dedupeOpenOnly: true,
                    name: `Low production — review for dry-off — ${label}`,
                    details: `${label} (${tagNumber}) has produced at or below ${lactation_alerts_1.DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L}L/day for ${lactation_alerts_1.DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS}+ consecutive days — recommend reviewing for dry-off (this is a suggestion, not an automatic dry-off).`,
                    category: client_1.TaskCategory.BREEDING,
                    priority: client_1.TaskPriority.MEDIUM,
                    dueAt: now,
                });
            }
        }
        return created;
    }
    async raiseLactationAlertTask(params) {
        const marker = `[LACTATION_ALERT:${params.tag}]`;
        const existing = await this.prisma.task.findFirst({
            where: {
                farmId: params.farmId,
                relatedCattleId: params.cattleId,
                details: { contains: marker },
                ...(params.dedupeOpenOnly
                    ? { status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] } }
                    : {}),
            },
            select: { id: true },
        });
        if (existing)
            return 0;
        await this.taskService.createInternal({
            farmId: params.farmId,
            createdBy: 'SYSTEM',
            name: params.name,
            details: `${marker} ${params.details}`,
            category: params.category,
            priority: params.priority,
            dueAt: params.dueAt,
            source: client_1.TaskSource.SYSTEM_AUTO,
            relatedCattleId: params.cattleId,
        });
        return 1;
    }
    async emit(input) {
        const created = await this.notifications.notifyFarmRoles({
            ...input,
            roleNames: BOSSES,
        });
        return created.length;
    }
    ymd(date) {
        return date.toISOString().slice(0, 10);
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_5AM, { name: 'daily-notification-sweeps' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "runDailySweeps", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        subscription_lifecycle_service_1.SubscriptionLifecycleService,
        renewal_reminder_service_1.RenewalReminderService,
        reconciliation_service_1.ReconciliationService,
        balance_service_1.BalanceService,
        farm_settings_service_1.FarmSettingsService,
        health_service_1.HealthService,
        task_service_1.TaskService,
        feed_plan_fit_sweep_service_1.FeedPlanFitSweepService,
        health_reminder_service_1.HealthReminderService,
        health_cycle_service_1.HealthCycleService,
        follow_up_reminder_service_1.FollowUpReminderService,
        farm_clock_service_1.FarmClockService,
        notification_scheduler_service_1.NotificationScheduler,
        overdue_nag_service_1.OverdueNagService,
        logger_service_1.LoggerService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map