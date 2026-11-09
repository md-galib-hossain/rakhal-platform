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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthStepNotificationProducer = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const notification_scheduler_service_1 = require("src/modules/notification/application/services/notification-scheduler.service");
const schedule_math_1 = require("src/modules/notification/domain/schedule-math");
const health_step_source_resolver_1 = require("./health-step-source.resolver");
const PREVENTIVE_LEADS = [10080, 1440, 0];
const CURATIVE_LEADS = [0];
const TIMED_LEADS = [1440, 60];
const LIVE_TASK_STATUSES = [
    client_1.HealthTaskStatus.PENDING,
    client_1.HealthTaskStatus.RESCHEDULED,
    client_1.HealthTaskStatus.OVERDUE,
];
let HealthStepNotificationProducer = class HealthStepNotificationProducer {
    prisma;
    scheduler;
    resolver;
    farmClock;
    constructor(prisma, scheduler, resolver, farmClock) {
        this.prisma = prisma;
        this.scheduler = scheduler;
        this.resolver = resolver;
        this.farmClock = farmClock;
    }
    get enabled() {
        return this.scheduler.enabled;
    }
    syncTasks(tx, farmId, taskIds, extraKeys = []) {
        return this.run(tx, async () => {
            if (!this.enabled)
                return null;
            const keys = [
                ...extraKeys,
                ...(await this.keysForTasks(farmId, taskIds)),
            ];
            return this.syncKeys(farmId, keys);
        });
    }
    syncCases(tx, farmId, caseIds, extraKeys = []) {
        return this.run(tx, async () => {
            if (!this.enabled)
                return null;
            const keys = [...extraKeys];
            for (const id of caseIds) {
                keys.push(...(await this.keysForCase(farmId, id)));
            }
            return this.syncKeys(farmId, keys);
        });
    }
    syncRound(tx, farmId, planApplicationId) {
        return this.run(tx, async () => {
            if (!this.enabled)
                return null;
            const tz = await this.farmClock.timezone(farmId);
            const rows = await this.prisma.healthTask.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    status: { in: LIVE_TASK_STATUSES },
                    planEnrollment: { is: { planApplicationId } },
                },
                select: { dueDateTime: true },
            });
            return this.syncKeys(farmId, rows.map((r) => (0, health_step_source_resolver_1.stepSourceKey)({
                kind: 'round',
                id: planApplicationId,
                ymd: (0, farm_time_1.localDateIso)(tz, r.dueDateTime),
            })));
        });
    }
    keysOfTasks(tx, farmId, taskIds) {
        return this.run(tx, () => this.keysForTasks(farmId, taskIds));
    }
    keysOfCase(tx, farmId, caseId) {
        return this.run(tx, () => this.keysForCase(farmId, caseId));
    }
    async enqueueAfterCommit(ids) {
        if (!ids || ids.length === 0)
            return;
        await this.scheduler.enqueueAfterCommit(ids);
    }
    run(tx, fn) {
        return tx ? tx_context_1.txStore.run({ tx }, fn) : fn();
    }
    async keysForTasks(farmId, taskIds) {
        if (!this.enabled || taskIds.length === 0)
            return [];
        const tz = await this.farmClock.timezone(farmId);
        const rows = await this.prisma.healthTask.findMany({
            where: { farmId, id: { in: taskIds } },
            select: {
                dueDateTime: true,
                healthCaseId: true,
                planEnrollment: { select: { planApplicationId: true } },
            },
        });
        const keys = [];
        for (const r of rows) {
            const ymd = (0, farm_time_1.localDateIso)(tz, r.dueDateTime);
            if (r.planEnrollment) {
                keys.push((0, health_step_source_resolver_1.stepSourceKey)({
                    kind: 'round',
                    id: r.planEnrollment.planApplicationId,
                    ymd,
                }));
            }
            else if (r.healthCaseId) {
                keys.push((0, health_step_source_resolver_1.stepSourceKey)({ kind: 'case', id: r.healthCaseId, ymd }));
            }
        }
        return keys;
    }
    async keysForCase(farmId, caseId) {
        if (!this.enabled)
            return [];
        const tz = await this.farmClock.timezone(farmId);
        const rows = await this.prisma.healthTask.findMany({
            where: {
                farmId,
                healthCaseId: caseId,
                deletedAt: null,
                status: { in: LIVE_TASK_STATUSES },
            },
            select: { dueDateTime: true },
        });
        return rows.map((r) => (0, health_step_source_resolver_1.stepSourceKey)({
            kind: 'case',
            id: caseId,
            ymd: (0, farm_time_1.localDateIso)(tz, r.dueDateTime),
        }));
    }
    async syncKeys(farmId, keys) {
        const tz = await this.farmClock.timezone(farmId);
        const toEnqueue = [];
        for (const key of new Set(keys)) {
            const ref = (0, health_step_source_resolver_1.parseStepSourceKey)(key);
            if (!ref)
                continue;
            const group = await this.resolver.loadGroup(farmId, ref, tz);
            if (group.live.length === 0) {
                await this.scheduler.cancelForSource(farmId, 'HEALTH_STEP', key);
                continue;
            }
            const timed = group.live.find((s) => s.timeOfDay);
            const result = await this.scheduler.upsertForSource({
                farmId,
                sourceType: 'HEALTH_STEP',
                sourceKey: key,
                anchorAt: timed ? timed.dueDateTime : (0, schedule_math_1.allDayAnchorFromYmd)(ref.ymd),
                allDay: !timed,
                leadMinutes: timed
                    ? TIMED_LEADS
                    : ref.kind === 'round'
                        ? PREVENTIVE_LEADS
                        : CURATIVE_LEADS,
                eventKey: 'scheduled_upcoming',
                category: 'health_safety',
                priority: 'medium',
                audienceHint: { roles: ['Owner', 'Manager'] },
            });
            if (result)
                toEnqueue.push(...result.toEnqueue);
        }
        return toEnqueue;
    }
};
exports.HealthStepNotificationProducer = HealthStepNotificationProducer;
exports.HealthStepNotificationProducer = HealthStepNotificationProducer = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_scheduler_service_1.NotificationScheduler,
        health_step_source_resolver_1.HealthStepSourceResolver,
        farm_clock_service_1.FarmClockService])
], HealthStepNotificationProducer);
//# sourceMappingURL=health-step-notification.producer.js.map