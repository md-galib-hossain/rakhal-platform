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
exports.HealthPlanStatsService = void 0;
exports.liveStepWhere = liveStepWhere;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const health_plan_stats_1 = require("../../domain/health-plan-stats");
const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_WINDOW_DAYS = 7;
const OPEN_STEP_STATUSES = [
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
function liveStepWhere(farmId) {
    return {
        farmId,
        deletedAt: null,
        status: { in: OPEN_STEP_STATUSES },
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
    };
}
let HealthPlanStatsService = class HealthPlanStatsService {
    prisma;
    clock;
    constructor(prisma, clock) {
        this.prisma = prisma;
        this.clock = clock;
    }
    async statsFor(farmId, plans, now = new Date()) {
        if (plans.length === 0)
            return new Map();
        const ids = plans.map((plan) => plan.id);
        const horizon = new Date(now.getTime() + DUE_WINDOW_DAYS * DAY_MS);
        const timezone = await this.clock.timezone(farmId);
        const live = liveStepWhere(farmId);
        const [cases, enrollments, due, closeSteps, nextSteps] = await Promise.all([
            this.prisma.healthCase.findMany({
                where: { farmId, healthPlanId: { in: ids }, deletedAt: null },
                select: { healthPlanId: true, cattleId: true, status: true },
            }),
            this.prisma.planEnrollment.findMany({
                where: { farmId, healthPlanId: { in: ids }, deletedAt: null },
                select: { healthPlanId: true, cattleId: true, status: true },
            }),
            this.prisma.healthTask.groupBy({
                by: ['healthPlanId'],
                where: {
                    farmId,
                    healthPlanId: { in: ids },
                    deletedAt: null,
                    planEnrollmentId: { not: null },
                    status: { in: OPEN_STEP_STATUSES },
                    dueDateTime: { lte: horizon },
                    planEnrollment: {
                        is: { status: client_1.PlanEnrollmentStatus.ACTIVE, deletedAt: null },
                    },
                },
                _count: { _all: true },
            }),
            this.prisma.healthTask.findMany({
                where: {
                    ...live,
                    healthPlanId: { in: ids },
                    dueDateTime: { lt: new Date(now.getTime() + 2 * DAY_MS) },
                },
                select: { healthPlanId: true, dueDateTime: true },
            }),
            this.prisma.healthTask.groupBy({
                by: ['healthPlanId'],
                where: { ...live, healthPlanId: { in: ids } },
                _min: { dueDateTime: true },
            }),
        ]);
        const casesByPlan = group(cases);
        const enrollmentsByPlan = group(enrollments);
        const dueByPlan = new Map(due.map((row) => [row.healthPlanId, row._count._all]));
        const closeByPlan = new Map();
        for (const step of closeSteps) {
            if (!step.healthPlanId)
                continue;
            const list = closeByPlan.get(step.healthPlanId);
            if (list)
                list.push(step.dueDateTime);
            else
                closeByPlan.set(step.healthPlanId, [step.dueDateTime]);
        }
        const nextByPlan = new Map(nextSteps.flatMap((row) => row.healthPlanId && row._min.dueDateTime
            ? [[row.healthPlanId, row._min.dueDateTime]]
            : []));
        return new Map(plans.map((plan) => {
            const next = nextByPlan.get(plan.id);
            const schedule = next
                ? {
                    ...(0, health_plan_stats_1.countStepsByFarmDay)(closeByPlan.get(plan.id) ?? [], timezone, now),
                    nextDueDate: (0, farm_time_1.localDateIso)(timezone, next),
                }
                : health_plan_stats_1.NO_SCHEDULE;
            return [
                plan.id,
                (0, health_plan_stats_1.computePlanStats)(plan.category, casesByPlan.get(plan.id) ?? [], enrollmentsByPlan.get(plan.id) ?? [], dueByPlan.get(plan.id) ?? 0, schedule),
            ];
        }));
    }
    async attach(farmId, page) {
        const stats = await this.statsFor(farmId, page.items);
        return {
            ...page,
            items: page.items.map((plan) => ({
                ...plan,
                stats: stats.get(plan.id),
            })),
        };
    }
};
exports.HealthPlanStatsService = HealthPlanStatsService;
exports.HealthPlanStatsService = HealthPlanStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService])
], HealthPlanStatsService);
function group(rows) {
    const map = new Map();
    for (const row of rows) {
        if (!row.healthPlanId)
            continue;
        const list = map.get(row.healthPlanId);
        if (list)
            list.push(row);
        else
            map.set(row.healthPlanId, [row]);
    }
    return map;
}
//# sourceMappingURL=health-plan-stats.service.js.map