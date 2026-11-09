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
exports.AnimalUpcomingEventsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const health_farm_day_1 = require("src/modules/health/domain/health-farm-day");
const animal_upcoming_events_1 = require("../../domain/animal-upcoming-events");
const LIVE_HEALTH_TASK_STATUSES = [
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
const OPEN_TASK_STATUSES = [
    client_1.TaskStatus.PENDING,
    client_1.TaskStatus.IN_PROGRESS,
    client_1.TaskStatus.BLOCKED,
];
let AnimalUpcomingEventsService = class AnimalUpcomingEventsService {
    prisma;
    clock;
    constructor(prisma, clock) {
        this.prisma = prisma;
        this.clock = clock;
    }
    async forCattle(farmId, cattleIds, options = {}) {
        const result = new Map();
        const ids = [...new Set(cattleIds)];
        for (const id of ids)
            result.set(id, { events: [], total: 0 });
        if (ids.length === 0)
            return result;
        const now = options.now ?? new Date();
        const windowDays = options.windowDays ?? animal_upcoming_events_1.DEFAULT_WINDOW_DAYS;
        const limit = options.limit ?? animal_upcoming_events_1.DEFAULT_EVENT_LIMIT;
        const timezone = await this.clock.timezone(farmId);
        const windowEnd = windowEndFor(now, timezone, windowDays);
        const [tasks, breedings, pregnancies, lactations, withdrawals, hubTasks] = await Promise.all([
            this.prisma.healthTask.findMany({
                where: {
                    farmId,
                    cattleId: { in: ids },
                    deletedAt: null,
                    status: { in: LIVE_HEALTH_TASK_STATUSES },
                    dueDateTime: { lt: windowEnd },
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
                },
                select: {
                    id: true,
                    cattleId: true,
                    title: true,
                    dueDateTime: true,
                    planEnrollmentId: true,
                },
            }),
            this.prisma.breedingEvent.findMany({
                where: {
                    cattleId: { in: ids },
                    cattle: { farmId },
                    voidedAt: null,
                },
                orderBy: [{ breedingDate: 'desc' }, { id: 'desc' }],
                distinct: ['cattleId'],
                select: {
                    id: true,
                    cattleId: true,
                    status: true,
                    expectedPregnancyCheckDate: true,
                },
            }),
            this.prisma.pregnancy.findMany({
                where: {
                    cattleId: { in: ids },
                    cattle: { farmId },
                    status: client_1.PregnancyStatus.ACTIVE,
                    expectedCalvingDate: { not: null, lt: windowEnd },
                },
                select: { id: true, cattleId: true, expectedCalvingDate: true },
            }),
            this.prisma.lactation.findMany({
                where: {
                    cattleId: { in: ids },
                    cattle: { farmId },
                    status: client_1.LactationStatus.ACTIVE,
                    OR: [
                        { plannedDryOffAt: { not: null } },
                        { recommendedDryOffAt: { not: null } },
                    ],
                },
                select: {
                    id: true,
                    cattleId: true,
                    plannedDryOffAt: true,
                    recommendedDryOffAt: true,
                },
            }),
            this.prisma.safetyWithdrawal.findMany({
                where: {
                    farmId,
                    cattleId: { in: ids },
                    status: client_1.SafetyWithdrawalStatus.ACTIVE,
                },
                select: {
                    id: true,
                    cattleId: true,
                    milkWithdrawalUntil: true,
                    meatWithdrawalUntil: true,
                },
            }),
            this.prisma.task.findMany({
                where: {
                    farmId,
                    status: { in: OPEN_TASK_STATUSES },
                    dueAt: { lt: windowEnd },
                    OR: [
                        { relatedCattleId: { in: ids } },
                        { cattles: { some: { cattleId: { in: ids } } } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    dueAt: true,
                    relatedCattleId: true,
                    sourceEventType: true,
                    sourceEventId: true,
                    cattles: { select: { cattleId: true } },
                },
            }),
        ]);
        const byCattle = new Map();
        const push = (cattleId, candidate) => {
            const list = byCattle.get(cattleId);
            if (list)
                list.push(candidate);
            else
                byCattle.set(cattleId, [candidate]);
        };
        for (const t of tasks) {
            const preventive = t.planEnrollmentId !== null;
            push(t.cattleId, {
                kind: preventive ? 'PREVENTIVE_STEP' : 'HEALTH_STEP',
                labelKey: preventive
                    ? 'cattle.upcoming.preventiveStep'
                    : 'cattle.upcoming.healthStep',
                labelParams: { title: t.title },
                dueAt: t.dueDateTime,
                actionable: true,
                ref: { type: 'HEALTH_TASK', id: t.id },
            });
        }
        for (const b of breedings) {
            if (b.status !== client_1.BreedingStatus.PENDING_CHECK ||
                !b.expectedPregnancyCheckDate) {
                continue;
            }
            push(b.cattleId, {
                kind: 'PREGNANCY_CHECK',
                labelKey: 'cattle.upcoming.pregnancyCheck',
                dueAt: b.expectedPregnancyCheckDate,
                actionable: true,
                ref: { type: 'BREEDING_EVENT', id: b.id },
                coversSourceKeys: [`BREEDING_EVENT:${b.id}`],
            });
        }
        for (const p of pregnancies) {
            if (!p.expectedCalvingDate)
                continue;
            push(p.cattleId, {
                kind: 'CALVING',
                labelKey: 'cattle.upcoming.calving',
                dueAt: p.expectedCalvingDate,
                actionable: true,
                ref: { type: 'PREGNANCY', id: p.id },
            });
        }
        for (const l of lactations) {
            const dryOff = l.plannedDryOffAt ?? l.recommendedDryOffAt;
            if (!dryOff)
                continue;
            push(l.cattleId, {
                kind: 'DRY_OFF',
                labelKey: 'cattle.upcoming.dryOff',
                dueAt: dryOff,
                actionable: true,
                ref: { type: 'LACTATION', id: l.id },
            });
        }
        for (const w of withdrawals) {
            if (w.milkWithdrawalUntil) {
                push(w.cattleId, {
                    kind: 'WITHDRAWAL_END',
                    labelKey: 'cattle.upcoming.milkWithdrawalEnd',
                    dueAt: w.milkWithdrawalUntil,
                    actionable: false,
                    ref: { type: 'SAFETY_WITHDRAWAL', id: w.id },
                });
            }
            if (w.meatWithdrawalUntil) {
                push(w.cattleId, {
                    kind: 'WITHDRAWAL_END',
                    labelKey: 'cattle.upcoming.meatWithdrawalEnd',
                    dueAt: w.meatWithdrawalUntil,
                    actionable: false,
                    ref: { type: 'SAFETY_WITHDRAWAL', id: w.id },
                });
            }
        }
        const wanted = new Set(ids);
        for (const t of hubTasks) {
            const targets = new Set();
            if (t.relatedCattleId)
                targets.add(t.relatedCattleId);
            for (const c of t.cattles)
                targets.add(c.cattleId);
            for (const cattleId of targets) {
                if (!wanted.has(cattleId))
                    continue;
                push(cattleId, {
                    kind: 'TASK',
                    labelKey: 'cattle.upcoming.task',
                    labelParams: { title: t.name },
                    dueAt: t.dueAt,
                    actionable: true,
                    ref: { type: 'TASK', id: t.id },
                    ...(t.sourceEventType && t.sourceEventId
                        ? { sourceKey: `${t.sourceEventType}:${t.sourceEventId}` }
                        : {}),
                });
            }
        }
        for (const [cattleId, candidates] of byCattle) {
            const events = (0, animal_upcoming_events_1.buildAnimalUpcomingEvents)(candidates, {
                now,
                timezone,
                windowDays,
            });
            result.set(cattleId, {
                events: events.slice(0, limit),
                total: events.length,
            });
        }
        return result;
    }
    async dueFilterWhere(farmId, filter, now = new Date()) {
        const timezone = await this.clock.timezone(farmId);
        const today = (0, farm_time_1.localDateIso)(timezone, now);
        const todayStart = (0, health_farm_day_1.farmDayStart)(today, timezone);
        const range = filter === 'overdue'
            ? { lt: todayStart }
            : filter === 'today'
                ? { gte: todayStart, lt: (0, health_farm_day_1.farmDayEnd)(today, timezone) }
                : {
                    gte: todayStart,
                    lt: (0, health_farm_day_1.farmDayEnd)(addDaysYmd(today, animal_upcoming_events_1.DUE_WEEK_DAYS), timezone),
                };
        const hubTasks = await this.prisma.task.findMany({
            where: { farmId, status: { in: OPEN_TASK_STATUSES }, dueAt: range },
            select: {
                relatedCattleId: true,
                cattles: { select: { cattleId: true } },
            },
        });
        const taskCattleIds = new Set();
        for (const t of hubTasks) {
            if (t.relatedCattleId)
                taskCattleIds.add(t.relatedCattleId);
            for (const c of t.cattles)
                taskCattleIds.add(c.cattleId);
        }
        const or = [
            {
                healthTasks: {
                    some: {
                        deletedAt: null,
                        status: { in: LIVE_HEALTH_TASK_STATUSES },
                        dueDateTime: range,
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
                    },
                },
            },
            {
                breedingEvents: {
                    some: {
                        status: client_1.BreedingStatus.PENDING_CHECK,
                        voidedAt: null,
                        expectedPregnancyCheckDate: range,
                    },
                },
            },
            {
                pregnancies: {
                    some: { status: client_1.PregnancyStatus.ACTIVE, expectedCalvingDate: range },
                },
            },
            {
                lactations: {
                    some: {
                        status: client_1.LactationStatus.ACTIVE,
                        OR: [
                            { plannedDryOffAt: range },
                            { plannedDryOffAt: null, recommendedDryOffAt: range },
                        ],
                    },
                },
            },
        ];
        if (taskCattleIds.size > 0) {
            or.push({ id: { in: [...taskCattleIds] } });
        }
        return { OR: or };
    }
};
exports.AnimalUpcomingEventsService = AnimalUpcomingEventsService;
exports.AnimalUpcomingEventsService = AnimalUpcomingEventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService])
], AnimalUpcomingEventsService);
function addDaysYmd(ymd, n) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function windowEndFor(now, timezone, windowDays) {
    return (0, health_farm_day_1.farmDayEnd)(addDaysYmd((0, farm_time_1.localDateIso)(timezone, now), windowDays), timezone);
}
//# sourceMappingURL=animal-upcoming-events.service.js.map