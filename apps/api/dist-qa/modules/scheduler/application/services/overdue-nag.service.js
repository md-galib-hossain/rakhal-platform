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
var OverdueNagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverdueNagService = exports.OVERDUE_MAX_DAYS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_scheduler_service_1 = require("src/modules/notification/application/services/notification-scheduler.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const DAY_MS = 24 * 60 * 60 * 1000;
exports.OVERDUE_MAX_DAYS = 30;
const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const LIVE_STEP_STATUSES = [
    client_1.HealthTaskStatus.PENDING,
    client_1.HealthTaskStatus.RESCHEDULED,
    client_1.HealthTaskStatus.OVERDUE,
];
const OPEN_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
let OverdueNagService = OverdueNagService_1 = class OverdueNagService {
    prisma;
    notifications;
    farmClock;
    scheduler;
    log;
    constructor(prisma, notifications, farmClock, scheduler, logger) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.farmClock = farmClock;
        this.scheduler = scheduler;
        this.log = logger.setContext(OverdueNagService_1.name);
    }
    async sweepAll(now = new Date()) {
        if (!this.scheduler.enabled)
            return 0;
        const groups = new Map();
        await this.collectRuleTasks(now, groups);
        await this.collectHealthSteps(now, groups);
        let sent = 0;
        for (const [farmId, byKey] of groups) {
            try {
                const todayYmd = (0, farm_time_1.localDateIso)(await this.farmClock.timezone(farmId), now);
                for (const g of byKey.values()) {
                    sent += await this.notify(farmId, g, todayYmd);
                }
            }
            catch (err) {
                this.log.error('Overdue nag failed for a farm', {
                    farmId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return sent;
    }
    async notify(farmId, g, todayYmd) {
        const animals = g.cattleIds.size;
        const created = await this.notifications.notifyOwnersAndManagers({
            farmId,
            eventKey: 'scheduled_overdue',
            title: 'Overdue',
            message: `${g.label}: ${animals} animal(s) overdue since ${g.dueYmd}.`,
            params: {
                label: g.label,
                animals,
                date: g.dueYmd,
                days: g.daysOverdue,
            },
            link: g.link,
            dedupeKey: `ov:${g.sourceType}:${g.groupKey}:${todayYmd}`,
        });
        return created.length;
    }
    daysOverdue(dueYmd, todayYmd) {
        return Math.round(((0, farm_time_1.dayKey)(todayYmd).getTime() - (0, farm_time_1.dayKey)(dueYmd).getTime()) / DAY_MS);
    }
    group(groups, farmId, g) {
        const byKey = groups.get(farmId) ?? new Map();
        groups.set(farmId, byKey);
        const id = `${g.sourceType}|${g.groupKey}`;
        const existing = byKey.get(id);
        if (existing)
            return existing;
        byKey.set(id, g);
        return g;
    }
    async collectRuleTasks(now, groups) {
        const tasks = await this.prisma.task.findMany({
            where: {
                ruleKey: { not: null },
                kind: 'TASK',
                status: { in: [...OPEN_TASK_STATUSES] },
                dueAt: {
                    gte: new Date(now.getTime() - (exports.OVERDUE_MAX_DAYS + 2) * DAY_MS),
                    lt: now,
                },
            },
            select: {
                farmId: true,
                ruleKey: true,
                name: true,
                dueAt: true,
                relatedCattleId: true,
                cattles: { select: { cattleId: true } },
            },
        });
        if (tasks.length === 0)
            return;
        const idsOf = (t) => [
            ...new Set([
                ...(t.relatedCattleId ? [t.relatedCattleId] : []),
                ...t.cattles.map((c) => c.cattleId),
            ]),
        ];
        const allIds = [...new Set(tasks.flatMap(idsOf))];
        const live = new Set(allIds.length
            ? (await this.prisma.cattle.findMany({
                where: {
                    id: { in: allIds },
                    herdStatus: client_1.HerdStatus.ACTIVE,
                    deletedAt: null,
                },
                select: { id: true },
            })).map((c) => c.id)
            : []);
        const tzByFarm = new Map();
        for (const t of tasks) {
            let tz = tzByFarm.get(t.farmId);
            if (!tz) {
                tz = await this.farmClock.timezone(t.farmId);
                tzByFarm.set(t.farmId, tz);
            }
            const ids = idsOf(t);
            if (ids.length > 0 && !ids.some((id) => live.has(id)))
                continue;
            const dueYmd = (0, farm_time_1.localDateIso)(tz, t.dueAt);
            const days = this.daysOverdue(dueYmd, (0, farm_time_1.localDateIso)(tz, now));
            if (days < 1 || days > exports.OVERDUE_MAX_DAYS)
                continue;
            const g = this.group(groups, t.farmId, {
                sourceType: 'TASK',
                groupKey: `rule:${t.ruleKey}:${dueYmd}`,
                label: t.name,
                cattleIds: new Set(),
                dueYmd,
                daysOverdue: days,
                link: `/animals?due=${t.ruleKey}`,
            });
            for (const id of ids)
                if (live.has(id))
                    g.cattleIds.add(id);
        }
    }
    async collectHealthSteps(now, groups) {
        const steps = await this.prisma.healthTask.findMany({
            where: {
                deletedAt: null,
                status: { in: LIVE_STEP_STATUSES },
                dueDateTime: {
                    gte: new Date(now.getTime() - (exports.OVERDUE_MAX_DAYS + 2) * DAY_MS),
                    lt: now,
                },
                cattle: { herdStatus: client_1.HerdStatus.ACTIVE, deletedAt: null },
                OR: [
                    {
                        healthCase: {
                            is: { status: { in: OPEN_CASE_STATUSES }, deletedAt: null },
                        },
                    },
                    {
                        planEnrollment: {
                            is: { status: client_1.PlanEnrollmentStatus.ACTIVE, deletedAt: null },
                        },
                    },
                ],
            },
            select: {
                farmId: true,
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
            },
        });
        const tzByFarm = new Map();
        for (const s of steps) {
            let tz = tzByFarm.get(s.farmId);
            if (!tz) {
                tz = await this.farmClock.timezone(s.farmId);
                tzByFarm.set(s.farmId, tz);
            }
            const dueYmd = (0, farm_time_1.localDateIso)(tz, s.dueDateTime);
            const days = this.daysOverdue(dueYmd, (0, farm_time_1.localDateIso)(tz, now));
            if (days < 1 || days > exports.OVERDUE_MAX_DAYS)
                continue;
            const round = s.planEnrollment?.planApplicationId;
            const kindId = round
                ? `round:${round}`
                : s.healthCaseId
                    ? `case:${s.healthCaseId}`
                    : null;
            if (!kindId)
                continue;
            const planName = s.planEnrollment?.healthPlan.name ??
                s.healthCase?.healthPlan?.name ??
                s.healthPlan?.name ??
                s.title;
            const g = this.group(groups, s.farmId, {
                sourceType: 'HEALTH_STEP',
                groupKey: `${kindId}:${dueYmd}`,
                label: round
                    ? planName
                    : `${planName} · ${s.cattle.name ?? s.cattle.tagNumber}`,
                cattleIds: new Set(),
                dueYmd,
                daysOverdue: days,
                link: '/healthcare?healthTab=protocols&bucket=overdue',
            });
            g.cattleIds.add(s.cattleId);
        }
    }
};
exports.OverdueNagService = OverdueNagService;
exports.OverdueNagService = OverdueNagService = OverdueNagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        farm_clock_service_1.FarmClockService,
        notification_scheduler_service_1.NotificationScheduler,
        logger_service_1.LoggerService])
], OverdueNagService);
//# sourceMappingURL=overdue-nag.service.js.map