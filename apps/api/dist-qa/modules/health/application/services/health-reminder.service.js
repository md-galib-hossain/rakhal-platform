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
var HealthReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthReminderService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_time_1 = require("src/common/farm-time/farm-time");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const health_reminder_cadence_1 = require("../../domain/health-reminder-cadence");
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TASK_STATUSES = [
    client_1.HealthTaskStatus.PENDING,
    client_1.HealthTaskStatus.RESCHEDULED,
    client_1.HealthTaskStatus.OVERDUE,
];
const ACTIVE_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const TASK_SELECT = {
    id: true,
    cattleId: true,
    title: true,
    dueDateTime: true,
    healthCaseId: true,
    cattle: { select: { name: true, tagNumber: true } },
    healthCase: { select: { healthPlan: { select: { name: true } } } },
    planEnrollment: {
        select: {
            planApplicationId: true,
            healthPlan: { select: { name: true } },
        },
    },
    healthPlan: { select: { name: true } },
};
let HealthReminderService = HealthReminderService_1 = class HealthReminderService {
    prisma;
    notifications;
    clock;
    log;
    constructor(prisma, notifications, clock, logger) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.clock = clock;
        this.log = logger.setContext(HealthReminderService_1.name);
    }
    async sweepAll(now = new Date()) {
        const farms = await this.prisma.healthTask.findMany({
            where: this.liveWhere(now),
            select: { farmId: true },
            distinct: ['farmId'],
        });
        let sent = 0;
        for (const { farmId } of farms) {
            try {
                sent += await this.sweepFarm(farmId, now);
            }
            catch (err) {
                this.log.error('Health reminder sweep failed for a farm', {
                    farmId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return sent;
    }
    async sweepFarm(farmId, now = new Date()) {
        const timezone = await this.clock.timezone(farmId);
        const tasks = await this.prisma.healthTask.findMany({
            where: { ...this.liveWhere(now), farmId },
            select: TASK_SELECT,
        });
        const buckets = new Map();
        for (const task of tasks) {
            const daysUntil = (0, health_reminder_cadence_1.farmDaysUntil)(task.dueDateTime, timezone, now);
            const decision = (0, health_reminder_cadence_1.reminderFor)(daysUntil);
            if (!decision)
                continue;
            const groupKey = task.planEnrollment
                ? `app:${task.planEnrollment.planApplicationId}`
                : task.healthCaseId
                    ? `case:${task.healthCaseId}`
                    : `task:${task.id}`;
            const dueYmd = (0, farm_time_1.localDateIso)(timezone, task.dueDateTime);
            const stage = decision.kind === 'stage' ? decision.stage : null;
            const bucketKey = decision.kind === 'stage'
                ? `${groupKey}|${decision.stage}|${dueYmd}`
                : `${groupKey}|overdue`;
            const existing = buckets.get(bucketKey);
            if (existing) {
                existing.cattleIds.add(task.cattleId);
                if (dueYmd < existing.dueYmd)
                    existing.dueYmd = dueYmd;
                if (decision.kind === 'overdue') {
                    existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, decision.daysOverdue);
                }
                continue;
            }
            buckets.set(bucketKey, {
                stage,
                groupKey,
                curative: !task.planEnrollment,
                planName: this.planNameOf(task),
                animalLabel: task.cattle.name ?? task.cattle.tagNumber,
                cattleIds: new Set([task.cattleId]),
                dueYmd,
                daysUntil,
                maxDaysOverdue: decision.kind === 'overdue' ? decision.daysOverdue : 0,
            });
        }
        const todayYmd = (0, farm_time_1.localDateIso)(timezone, now);
        let sent = 0;
        for (const bucket of buckets.values()) {
            sent += await this.notify(farmId, bucket, todayYmd);
        }
        return sent;
    }
    async notify(farmId, bucket, todayYmd) {
        const count = bucket.cattleIds.size;
        const label = bucket.curative
            ? `${bucket.planName} · ${bucket.animalLabel}`
            : bucket.planName;
        const params = {
            label,
            count,
            date: bucket.dueYmd,
            days: bucket.stage === null ? bucket.maxDaysOverdue : bucket.daysUntil,
        };
        if (bucket.stage === null) {
            const created = await this.notifications.notifyOwnersAndManagers({
                farmId,
                eventKey: health_reminder_cadence_1.OVERDUE_EVENT_KEY,
                title: 'Health Step Overdue',
                message: `${label}: ${count} animal(s) overdue since ${bucket.dueYmd}.`,
                params,
                link: '/healthcare?healthTab=protocols&bucket=overdue',
                dedupeKey: `${health_reminder_cadence_1.OVERDUE_EVENT_KEY}:${bucket.groupKey}:${todayYmd}`,
            });
            return created.length;
        }
        const title = bucket.stage === 'DAY_OF'
            ? 'Health Step Due Today'
            : bucket.stage === 'T_MINUS_1'
                ? 'Health Step Due Tomorrow'
                : `Health Step Due in ${bucket.daysUntil} Days`;
        const created = await this.notifications.notifyOwnersAndManagers({
            farmId,
            eventKey: health_reminder_cadence_1.STAGE_EVENT_KEY[bucket.stage],
            title,
            message: `${label}: ${count} animal(s), due ${bucket.dueYmd}.`,
            params,
            link: `/healthcare?healthTab=protocols&date=${bucket.dueYmd}`,
            dedupeKey: `health_task:${bucket.groupKey}:${bucket.dueYmd}:${bucket.stage}`,
        });
        return created.length;
    }
    planNameOf(task) {
        return (task.planEnrollment?.healthPlan.name ??
            task.healthCase?.healthPlan?.name ??
            task.healthPlan?.name ??
            task.title);
    }
    liveWhere(now) {
        return {
            deletedAt: null,
            status: { in: LIVE_TASK_STATUSES },
            dueDateTime: {
                gte: new Date(now.getTime() - (health_reminder_cadence_1.OVERDUE_MAX_DAYS + 2) * DAY_MS),
                lt: new Date(now.getTime() + 9 * DAY_MS),
            },
            cattle: { herdStatus: client_1.HerdStatus.ACTIVE, deletedAt: null },
            OR: [
                {
                    healthCase: {
                        is: { status: { in: ACTIVE_CASE_STATUSES }, deletedAt: null },
                    },
                },
                {
                    planEnrollment: {
                        is: { status: client_1.PlanEnrollmentStatus.ACTIVE, deletedAt: null },
                    },
                },
            ],
        };
    }
};
exports.HealthReminderService = HealthReminderService;
exports.HealthReminderService = HealthReminderService = HealthReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        farm_clock_service_1.FarmClockService,
        logger_service_1.LoggerService])
], HealthReminderService);
//# sourceMappingURL=health-reminder.service.js.map