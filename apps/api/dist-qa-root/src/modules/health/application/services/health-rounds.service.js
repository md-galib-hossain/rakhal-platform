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
exports.HealthRoundsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const pagination_1 = require("src/common/pagination");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const health_round_1 = require("../../domain/health-round");
const health_plan_stats_1 = require("../../domain/health-plan-stats");
const health_farm_day_1 = require("../../domain/health-farm-day");
const health_service_1 = require("./health.service");
const OPEN_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const PLAN_SELECT = {
    id: true,
    name: true,
    category: true,
    deletedAt: true,
};
const CATTLE_LIVE_SELECT = {
    id: true,
    name: true,
    tagNumber: true,
    herdStatus: true,
    deletedAt: true,
};
const TASK_SELECT = {
    id: true,
    healthPlanId: true,
    healthCaseId: true,
    planEnrollmentId: true,
    stepNumber: true,
    title: true,
    status: true,
    dueDateTime: true,
    completedAt: true,
    createdAt: true,
};
const isActiveHerd = (cattle) => cattle.herdStatus === client_1.HerdStatus.ACTIVE && cattle.deletedAt === null;
let HealthRoundsService = class HealthRoundsService {
    prisma;
    clock;
    health;
    constructor(prisma, clock, health) {
        this.prisma = prisma;
        this.clock = clock;
        this.health = health;
    }
    async list(farmId, query) {
        const timezone = await this.clock.timezone(farmId);
        const now = new Date();
        const dayOf = (d) => (0, farm_time_1.localDateIso)(timezone, d);
        const compare = roundCompare(query);
        const plans = (await this.prisma.healthPlan.findMany({
            where: {
                farmId,
                ...(query.healthPlanId ? { id: query.healthPlanId } : {}),
                ...(query.search
                    ? { name: { contains: query.search, mode: 'insensitive' } }
                    : {}),
            },
            select: PLAN_SELECT,
        })).filter((plan) => !query.kind || (0, health_plan_stats_1.planKind)(plan.category) === query.kind);
        if (plans.length === 0)
            return keysetPage([], compare, query);
        const planIds = plans.map((plan) => plan.id);
        const [applications, enrollments, cases, tasks] = await Promise.all([
            this.prisma.planApplication.findMany({
                where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
                select: { id: true, healthPlanId: true, startDate: true },
            }),
            this.prisma.planEnrollment.findMany({
                where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
                select: {
                    id: true,
                    planApplicationId: true,
                    cattleId: true,
                    status: true,
                    cattle: { select: CATTLE_LIVE_SELECT },
                },
            }),
            this.prisma.healthCase.findMany({
                where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
                select: {
                    id: true,
                    healthPlanId: true,
                    cattleId: true,
                    status: true,
                    startDate: true,
                    cattle: { select: CATTLE_LIVE_SELECT },
                },
            }),
            this.prisma.healthTask.findMany({
                where: { farmId, healthPlanId: { in: planIds }, deletedAt: null },
                select: TASK_SELECT,
            }),
        ]);
        const planById = new Map(plans.map((plan) => [plan.id, plan]));
        const drafts = new Map();
        const roundOfRun = new Map();
        const liveOfRun = new Map();
        for (const app of applications) {
            const plan = planById.get(app.healthPlanId);
            if (!plan)
                continue;
            const key = (0, health_round_1.applicationRoundKey)(app.id);
            drafts.set(key, {
                key,
                plan,
                startDate: dayOf(app.startDate),
                cattleIds: new Set(),
                tasks: [],
            });
        }
        for (const enrollment of enrollments) {
            const key = (0, health_round_1.applicationRoundKey)(enrollment.planApplicationId);
            const draft = drafts.get(key);
            if (!draft)
                continue;
            draft.cattleIds.add(enrollment.cattleId);
            roundOfRun.set(enrollment.id, key);
            liveOfRun.set(enrollment.id, enrollment.status === client_1.PlanEnrollmentStatus.ACTIVE &&
                isActiveHerd(enrollment.cattle));
        }
        const caseById = new Map(cases.map((c) => [c.id, c]));
        const appliedAt = firstStepCreatedAt(tasks, caseById);
        for (const c of cases) {
            const plan = planById.get(c.healthPlanId);
            if (!plan)
                continue;
            const day = dayOf(appliedAt.get(c.id) ?? c.startDate);
            const key = (0, health_round_1.treatmentRoundKey)(plan.id, day);
            let draft = drafts.get(key);
            if (!draft) {
                draft = { key, plan, startDate: day, cattleIds: new Set(), tasks: [] };
                drafts.set(key, draft);
            }
            draft.cattleIds.add(c.cattleId);
            roundOfRun.set(c.id, key);
            liveOfRun.set(c.id, OPEN_CASE_STATUSES.includes(c.status) && isActiveHerd(c.cattle));
        }
        for (const task of tasks) {
            const runId = task.planEnrollmentId ?? task.healthCaseId;
            if (!runId)
                continue;
            if (!task.planEnrollmentId && !caseOwnsTask(task, caseById))
                continue;
            const draft = drafts.get(roundOfRun.get(runId) ?? '');
            if (!draft)
                continue;
            draft.tasks.push(toFact(task, runId, liveOfRun.get(runId) ?? false));
        }
        const rows = [...drafts.values()]
            .map((draft) => ({
            roundKey: draft.key,
            healthPlan: draft.plan,
            kind: (0, health_plan_stats_1.planKind)(draft.plan.category),
            startDate: draft.startDate,
            animalCount: draft.cattleIds.size,
            ...(0, health_round_1.summarizeRound)(draft.tasks, timezone, now, dayOf),
        }))
            .filter((row) => !query.status || row.status === query.status);
        rows.sort((a, b) => compare(roundSortKey(a), roundSortKey(b)));
        return keysetPage(rows, compare, query, roundSortKey);
    }
    async addAnimals(farmId, userId, roundKey, dto) {
        const parts = (0, health_round_1.parseRoundKey)(roundKey);
        if (!parts)
            throw new common_1.NotFoundException('Round not found');
        const timezone = await this.clock.timezone(farmId);
        const withSteps = {
            steps: { orderBy: { dayNumber: 'asc' } },
        };
        let planId;
        let startDate;
        let applicationId;
        if (parts.type === 'APPLICATION') {
            const application = await this.prisma.planApplication.findFirst({
                where: { id: parts.applicationId, farmId, deletedAt: null },
                select: { startDate: true, healthPlanId: true },
            });
            if (!application)
                throw new common_1.NotFoundException('Round not found');
            planId = application.healthPlanId;
            startDate = application.startDate;
            applicationId = parts.applicationId;
        }
        else {
            planId = parts.planId;
            if (!(await this.treatmentRoundExists(farmId, planId, parts.day, timezone))) {
                throw new common_1.NotFoundException('Round not found');
            }
            startDate = new Date((0, health_farm_day_1.farmDayStart)(parts.day, timezone).getTime() + 12 * 60 * 60 * 1000);
        }
        const plan = await this.prisma.healthPlan.findFirst({
            where: { id: planId, farmId },
            include: withSteps,
        });
        if (!plan)
            throw new common_1.NotFoundException('Round not found');
        if (plan.deletedAt) {
            throw new common_1.BadRequestException('This protocol was deleted, so animals cannot be added to its rounds');
        }
        const result = await this.health.addAnimalsToRound(farmId, userId, {
            plan,
            cattleIds: dto.cattleIds,
            startDate,
            applicationId,
        });
        return {
            roundKey,
            addedCount: result.appliedCount,
            skippedCount: result.skippedCount,
            results: result.results,
        };
    }
    async cancelRound(farmId, userId, roundKey, reason) {
        const parts = (0, health_round_1.parseRoundKey)(roundKey);
        if (!parts)
            throw new common_1.NotFoundException('Round not found');
        const totals = {
            animals: 0,
            stepsRemoved: 0,
            dosesReversed: 0,
            casesRemoved: 0,
        };
        const add = (r) => {
            totals.animals += 1;
            totals.stepsRemoved += r.stepsRemoved;
            totals.dosesReversed += r.dosesReversed;
            if (r.caseRemoved)
                totals.casesRemoved += 1;
        };
        if (parts.type === 'APPLICATION') {
            const enrollments = await this.prisma.planEnrollment.findMany({
                where: {
                    farmId,
                    planApplicationId: parts.applicationId,
                    deletedAt: null,
                },
                select: { id: true },
            });
            if (enrollments.length === 0)
                throw new common_1.NotFoundException('Round not found');
            for (const e of enrollments) {
                add(await this.health.cancelEnrollment(farmId, userId, e.id, reason));
            }
        }
        else {
            const timezone = await this.clock.timezone(farmId);
            const caseIds = await this.treatmentRoundCaseIds(farmId, parts.planId, parts.day, timezone);
            if (caseIds.length === 0)
                throw new common_1.NotFoundException('Round not found');
            for (const id of caseIds) {
                add(await this.health.cancelCaseProtocol(farmId, userId, id, reason));
            }
        }
        return { roundKey, ...totals };
    }
    async treatmentRoundCaseIds(farmId, planId, day, timezone) {
        const cases = await this.prisma.healthCase.findMany({
            where: { farmId, healthPlanId: planId, deletedAt: null },
            select: { id: true, healthPlanId: true, startDate: true },
        });
        if (cases.length === 0)
            return [];
        const tasks = await this.prisma.healthTask.findMany({
            where: {
                farmId,
                deletedAt: null,
                healthPlanId: planId,
                healthCaseId: { in: cases.map((c) => c.id) },
            },
            select: TASK_SELECT,
        });
        const caseById = new Map(cases.map((c) => [c.id, c]));
        const appliedAt = firstStepCreatedAt(tasks, caseById);
        return cases
            .filter((c) => (0, farm_time_1.localDateIso)(timezone, appliedAt.get(c.id) ?? c.startDate) === day)
            .map((c) => c.id);
    }
    async treatmentRoundExists(farmId, planId, day, timezone) {
        const cases = await this.prisma.healthCase.findMany({
            where: { farmId, healthPlanId: planId, deletedAt: null },
            select: { id: true, healthPlanId: true, startDate: true },
        });
        if (cases.length === 0)
            return false;
        const tasks = await this.prisma.healthTask.findMany({
            where: {
                farmId,
                deletedAt: null,
                healthPlanId: planId,
                healthCaseId: { in: cases.map((c) => c.id) },
            },
            select: TASK_SELECT,
        });
        const caseById = new Map(cases.map((c) => [c.id, c]));
        const appliedAt = firstStepCreatedAt(tasks, caseById);
        return cases.some((c) => (0, farm_time_1.localDateIso)(timezone, appliedAt.get(c.id) ?? c.startDate) === day);
    }
    async grid(farmId, roundKey, query) {
        const parts = (0, health_round_1.parseRoundKey)(roundKey);
        if (!parts)
            throw new common_1.NotFoundException('Round not found');
        const timezone = await this.clock.timezone(farmId);
        const now = new Date();
        const dayOf = (d) => (0, farm_time_1.localDateIso)(timezone, d);
        let plan;
        let startDate;
        const runs = [];
        const liveOfRun = new Map();
        let taskRows;
        if (parts.type === 'APPLICATION') {
            const application = await this.prisma.planApplication.findFirst({
                where: { id: parts.applicationId, farmId, deletedAt: null },
                select: {
                    startDate: true,
                    healthPlan: {
                        select: {
                            ...PLAN_SELECT,
                            steps: {
                                select: { dayNumber: true, title: true },
                                orderBy: { dayNumber: 'asc' },
                            },
                        },
                    },
                },
            });
            if (!application)
                throw new common_1.NotFoundException('Round not found');
            plan = application.healthPlan;
            startDate = dayOf(application.startDate);
            const enrollments = await this.prisma.planEnrollment.findMany({
                where: {
                    farmId,
                    planApplicationId: parts.applicationId,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    status: true,
                    cattle: { select: CATTLE_LIVE_SELECT },
                },
            });
            for (const e of enrollments) {
                runs.push({
                    runKey: e.id,
                    runType: 'ENROLLMENT',
                    healthCaseId: null,
                    planEnrollmentId: e.id,
                    caseCode: null,
                    cattle: toCattle(e.cattle),
                });
                liveOfRun.set(e.id, e.status === client_1.PlanEnrollmentStatus.ACTIVE && isActiveHerd(e.cattle));
            }
            taskRows = enrollments.length
                ? await this.prisma.healthTask.findMany({
                    where: {
                        farmId,
                        deletedAt: null,
                        planEnrollmentId: { in: enrollments.map((e) => e.id) },
                    },
                    select: TASK_SELECT,
                })
                : [];
        }
        else {
            const found = await this.prisma.healthPlan.findFirst({
                where: { id: parts.planId, farmId },
                select: {
                    ...PLAN_SELECT,
                    steps: {
                        select: { dayNumber: true, title: true },
                        orderBy: { dayNumber: 'asc' },
                    },
                },
            });
            if (!found)
                throw new common_1.NotFoundException('Round not found');
            plan = found;
            startDate = parts.day;
            const cases = await this.prisma.healthCase.findMany({
                where: { farmId, healthPlanId: parts.planId, deletedAt: null },
                select: {
                    id: true,
                    caseCode: true,
                    healthPlanId: true,
                    status: true,
                    startDate: true,
                    cattle: { select: CATTLE_LIVE_SELECT },
                },
            });
            const allTasks = cases.length
                ? await this.prisma.healthTask.findMany({
                    where: {
                        farmId,
                        deletedAt: null,
                        healthPlanId: parts.planId,
                        healthCaseId: { in: cases.map((c) => c.id) },
                    },
                    select: TASK_SELECT,
                })
                : [];
            const caseById = new Map(cases.map((c) => [c.id, c]));
            const appliedAt = firstStepCreatedAt(allTasks, caseById);
            const members = cases.filter((c) => dayOf(appliedAt.get(c.id) ?? c.startDate) === parts.day);
            if (members.length === 0)
                throw new common_1.NotFoundException('Round not found');
            const memberIds = new Set(members.map((c) => c.id));
            for (const c of members) {
                runs.push({
                    runKey: c.id,
                    runType: 'CASE',
                    healthCaseId: c.id,
                    planEnrollmentId: null,
                    caseCode: c.caseCode,
                    cattle: toCattle(c.cattle),
                });
                liveOfRun.set(c.id, OPEN_CASE_STATUSES.includes(c.status) && isActiveHerd(c.cattle));
            }
            taskRows = allTasks.filter((t) => t.healthCaseId && memberIds.has(t.healthCaseId));
        }
        const facts = taskRows.map((task) => {
            const runId = (task.planEnrollmentId ?? task.healthCaseId);
            return toFact(task, runId, liveOfRun.get(runId) ?? false);
        });
        const { columns, rows } = (0, health_round_1.buildRoundGrid)(runs, facts, plan.steps, timezone, now);
        const shown = query.dueOnly ? rows.filter((row) => row.dueCount > 0) : rows;
        const items = shown.map((row) => ({
            runKey: row.runKey,
            runType: row.runType,
            healthCaseId: row.healthCaseId,
            planEnrollmentId: row.planEnrollmentId,
            caseCode: row.caseCode,
            cattle: row.cattle,
            dueCount: row.dueCount,
            overdueCount: row.overdueCount,
            cells: row.cells,
        }));
        const page = keysetPage(items, gridCompare, query, (item) => ({
            id: item.runKey,
            overdue: item.overdueCount,
            due: item.dueCount,
            label: item.cattle.name ?? item.cattle.tagNumber,
        }));
        return {
            data: {
                round: {
                    roundKey,
                    healthPlan: {
                        id: plan.id,
                        name: plan.name,
                        category: plan.category,
                        deletedAt: plan.deletedAt,
                    },
                    kind: (0, health_plan_stats_1.planKind)(plan.category),
                    startDate,
                    animalCount: runs.length,
                    ...(0, health_round_1.summarizeRound)(facts, timezone, now, dayOf),
                },
                columns,
                rows: page.items,
            },
            meta: page.meta,
        };
    }
};
exports.HealthRoundsService = HealthRoundsService;
exports.HealthRoundsService = HealthRoundsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService,
        health_service_1.HealthService])
], HealthRoundsService);
function toFact(task, runKey, live) {
    return {
        id: task.id,
        runKey,
        stepNumber: task.stepNumber,
        title: task.title,
        status: task.status,
        dueDateTime: task.dueDateTime,
        completedAt: task.completedAt,
        live,
    };
}
function toCattle(cattle) {
    return { id: cattle.id, name: cattle.name, tagNumber: cattle.tagNumber };
}
function caseOwnsTask(task, caseById) {
    const c = task.healthCaseId ? caseById.get(task.healthCaseId) : undefined;
    return Boolean(c && c.healthPlanId === task.healthPlanId);
}
function firstStepCreatedAt(tasks, caseById) {
    const first = new Map();
    for (const task of tasks) {
        if (!task.healthCaseId || !caseOwnsTask(task, caseById))
            continue;
        const prev = first.get(task.healthCaseId);
        if (!prev || task.createdAt < prev) {
            first.set(task.healthCaseId, task.createdAt);
        }
    }
    return first;
}
const roundSortKey = (row) => ({
    id: row.roundKey,
    startDate: row.startDate,
});
function roundCompare(query) {
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    return (a, b) => dir *
        (String(a.startDate).localeCompare(String(b.startDate)) ||
            a.id.localeCompare(b.id));
}
function gridCompare(a, b) {
    return (Number(b.overdue) - Number(a.overdue) ||
        Number(b.due) - Number(a.due) ||
        String(a.label).localeCompare(String(b.label)) ||
        a.id.localeCompare(b.id));
}
function keysetPage(rows, compare, query, sortKey = () => ({ id: '' })) {
    let start = 0;
    if (query.cursor) {
        const after = (0, pagination_1.decodeCursor)(query.cursor);
        const index = rows.findIndex((row) => compare(sortKey(row), after) > 0);
        start = index === -1 ? rows.length : index;
    }
    const page = rows.slice(start, start + query.limit);
    return {
        items: page,
        meta: {
            count: page.length,
            limit: query.limit,
            hasNextPage: start + query.limit < rows.length,
            hasPreviousPage: Boolean(query.cursor),
            startCursor: page.length ? (0, pagination_1.encodeCursor)(sortKey(page[0])) : null,
            endCursor: page.length
                ? (0, pagination_1.encodeCursor)(sortKey(page[page.length - 1]))
                : null,
        },
    };
}
//# sourceMappingURL=health-rounds.service.js.map