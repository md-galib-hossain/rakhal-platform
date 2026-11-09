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
var FeedPlanFitSweepService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedPlanFitSweepService = exports.OFF_TARGET_TASK_EVENT = exports.OFF_TARGET_DAYS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const task_service_1 = require("src/modules/task/application/services/task.service");
const fit_streak_1 = require("../../domain/fit-streak");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
const feed_plan_service_1 = require("./feed-plan.service");
exports.OFF_TARGET_DAYS = 3;
const FIT_CHUNK = 500;
exports.OFF_TARGET_TASK_EVENT = 'FEED_PLAN_OUT_OF_BAND';
const SEVERITY = { ok: 'OK', warn: 'WARN', bad: 'BAD' };
let FeedPlanFitSweepService = FeedPlanFitSweepService_1 = class FeedPlanFitSweepService {
    prisma;
    resolver;
    plans;
    tasks;
    log;
    constructor(prisma, logger, resolver, plans, tasks) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.plans = plans;
        this.tasks = tasks;
        this.log = logger.setContext(FeedPlanFitSweepService_1.name);
    }
    async sweepAll(now = new Date()) {
        const farms = await this.prisma.feedPlanAssignment.findMany({
            where: { removedAt: null, plan: { isActive: true } },
            select: { farmId: true },
            distinct: ['farmId'],
        });
        let raised = 0;
        for (const { farmId } of farms) {
            try {
                raised += await this.sweepFarm(farmId, now);
            }
            catch (err) {
                this.log.error('Feed plan fit sweep failed for a farm', {
                    farmId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return raised;
    }
    async sweepFarm(farmId, now = new Date()) {
        const ymd = now.toISOString().slice(0, 10);
        const day = new Date(`${ymd}T00:00:00.000Z`);
        const herd = await this.prisma.cattle.findMany({
            where: (0, herd_scope_1.activeHerd)(farmId),
            select: { id: true, tagNumber: true },
        });
        const tagById = new Map(herd.map((c) => [c.id, c.tagNumber]));
        const programs = await this.resolver.resolveForCattle(farmId, herd.map((c) => c.id));
        const byPlan = new Map();
        for (const [cattleId, p] of programs) {
            const e = byPlan.get(p.planId) ?? { name: p.planName, cattleIds: [] };
            e.cattleIds.push(cattleId);
            byPlan.set(p.planId, e);
        }
        let raised = 0;
        for (const [planId, { name, cattleIds }] of byPlan) {
            try {
                await this.recordDay(farmId, planId, cattleIds, ymd, day);
                raised += await this.digest(farmId, planId, name, ymd, cattleIds, tagById, now);
            }
            catch (err) {
                this.log.error('Feed plan fit sweep failed for a plan', {
                    farmId,
                    planId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return raised;
    }
    async recordDay(farmId, planId, cattleIds, ymd, day) {
        const data = [];
        for (let i = 0; i < cattleIds.length; i += FIT_CHUNK) {
            const res = await this.plans.fit(farmId, planId, {
                cattleIds: cattleIds.slice(i, i + FIT_CHUNK),
                date: ymd,
            });
            for (const c of res.cows) {
                data.push({
                    farmId,
                    planId,
                    cattleId: c.cattle_id,
                    date: day,
                    severity: SEVERITY[c.fit.severity],
                    estimated: c.fit.estimated,
                });
            }
        }
        await this.prisma.$transaction([
            this.prisma.feedPlanFitDay.deleteMany({
                where: { planId, date: day },
            }),
            this.prisma.feedPlanFitDay.createMany({ data }),
        ]);
    }
    async digest(farmId, planId, planName, ymd, cattleIds, tagById, now) {
        const dates = (0, fit_streak_1.streakDates)(ymd, exports.OFF_TARGET_DAYS);
        const stored = await this.prisma.feedPlanFitDay.findMany({
            where: {
                planId,
                cattleId: { in: cattleIds },
                date: { in: dates.map((d) => new Date(`${d}T00:00:00.000Z`)) },
                severity: { in: ['WARN', 'BAD'] },
                estimated: false,
            },
            select: {
                cattleId: true,
                date: true,
                severity: true,
                estimated: true,
            },
        });
        const rows = stored.map((r) => ({
            cattleId: r.cattleId,
            date: r.date.toISOString().slice(0, 10),
            severity: r.severity,
            estimated: r.estimated,
        }));
        const off = (0, fit_streak_1.offTargetCows)(rows, dates);
        if (off.length === 0)
            return 0;
        const eventId = `${planId}:${ymd}`;
        const existing = await this.prisma.task.findFirst({
            where: {
                farmId,
                sourceEventType: exports.OFF_TARGET_TASK_EVENT,
                sourceEventId: eventId,
            },
            select: { id: true },
        });
        if (existing)
            return 0;
        const tags = off
            .slice(0, 5)
            .map((id) => tagById.get(id) ?? id)
            .join(', ');
        const more = off.length > 5 ? ` and ${off.length - 5} more` : '';
        await this.tasks.createInternal({
            farmId,
            createdBy: 'SYSTEM',
            name: `Feed plan "${planName}": ${off.length} animal${off.length === 1 ? '' : 's'} off target ${exports.OFF_TARGET_DAYS} days running`,
            details: `Their daily dry matter, protein or energy from this plan has been outside the allowed range for ${exports.OFF_TARGET_DAYS} days in a row (measured, not estimated): ${tags}${more}. Open Feed plans to adjust the plan or give them their own. [plan:${planId}]`,
            category: client_1.TaskCategory.FEEDING,
            priority: client_1.TaskPriority.MEDIUM,
            dueAt: now,
            source: client_1.TaskSource.SYSTEM_AUTO,
            sourceEventType: exports.OFF_TARGET_TASK_EVENT,
            sourceEventId: eventId,
        });
        return 1;
    }
};
exports.FeedPlanFitSweepService = FeedPlanFitSweepService;
exports.FeedPlanFitSweepService = FeedPlanFitSweepService = FeedPlanFitSweepService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_plan_resolver_service_1.FeedPlanResolverService,
        feed_plan_service_1.FeedPlanService,
        task_service_1.TaskService])
], FeedPlanFitSweepService);
//# sourceMappingURL=feed-plan-fit-sweep.service.js.map