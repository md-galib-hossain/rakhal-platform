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
var FeedPlanAssignmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedPlanAssignmentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
let FeedPlanAssignmentService = FeedPlanAssignmentService_1 = class FeedPlanAssignmentService {
    prisma;
    resolver;
    activityLog;
    log;
    constructor(prisma, logger, resolver, activityLog) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.activityLog = activityLog;
        this.log = logger.setContext(FeedPlanAssignmentService_1.name);
    }
    async apply(farmId, userId, planId, dto) {
        const plan = await this.prisma.feedPlan.findFirst({
            where: { id: planId, farmId, isActive: true },
            select: { id: true, name: true },
        });
        if (!plan)
            throw new common_1.NotFoundException('Feed plan not found');
        const targets = await this.resolveTargets(farmId, dto);
        if (dto.targetType === 'GROUP') {
            await this.assertNoGroupOverlap(farmId, dto.animalGroupId);
        }
        const leavesGroupProgram = dto.targetType === 'INDIVIDUAL'
            ? [
                ...(await this.resolver.resolveForCattle(farmId, dto.cattleIds ?? [])),
            ]
                .filter(([, p]) => p.via === 'GROUP')
                .map(([cattleId, p]) => ({
                cattle_id: cattleId,
                group_id: p.groupId ?? null,
                plan_id: p.planId,
                plan_name: p.planName,
            }))
            : [];
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const now = new Date();
                const existing = await tx.feedPlanAssignment.findMany({
                    where: {
                        farmId,
                        removedAt: null,
                        OR: targets.map((t) => this.targetWhere(t)),
                    },
                    include: { plan: { select: { name: true } } },
                });
                if (existing.length > 0) {
                    await tx.feedPlanAssignment.updateMany({
                        where: { id: { in: existing.map((e) => e.id) } },
                        data: { removedAt: now, removedBy: userId },
                    });
                }
                const created = [];
                for (const t of targets) {
                    created.push(await tx.feedPlanAssignment.create({
                        data: {
                            farmId,
                            planId,
                            targetType: t.targetType,
                            cattleId: t.cattleId,
                            animalGroupId: t.animalGroupId,
                            appliedAt: now,
                            appliedBy: userId,
                        },
                    }));
                }
                return { existing, created };
            });
            await this.audit(farmId, userId, 'Feed program applied', `"${plan.name}" applied to ${this.describe(dto, targets.length)}`, dto.targetType === 'INDIVIDUAL' && targets.length === 1
                ? targets[0].cattleId
                : null);
            this.log.info('Feed plan applied', {
                farmId,
                planId,
                targetType: dto.targetType,
                targets: targets.length,
                replaced: result.existing.length,
            });
            return {
                plan_id: plan.id,
                assignments: result.created.map((a) => this.mapAssignment(a)),
                replaced: result.existing.map((e) => ({
                    ...this.mapAssignment({ ...e, removedAt: e.removedAt }),
                    plan_name: e.plan.name,
                })),
                leaves_group_program: leavesGroupProgram,
            };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException('Another program was applied to this target at the same moment — try again');
            }
            throw e;
        }
    }
    async remove(farmId, userId, assignmentId) {
        const row = await this.prisma.feedPlanAssignment.findFirst({
            where: { id: assignmentId, farmId },
            include: { plan: { select: { name: true } } },
        });
        if (!row)
            throw new common_1.NotFoundException('Program assignment not found');
        if (row.removedAt) {
            throw new common_1.ConflictException('This program has already been removed');
        }
        const updated = await this.prisma.feedPlanAssignment.update({
            where: { id: assignmentId },
            data: { removedAt: new Date(), removedBy: userId },
        });
        await this.audit(farmId, userId, 'Feed program removed', `"${row.plan.name}" removed from ${this.describeRow(row)}`, row.cattleId);
        this.log.info('Feed plan assignment removed', {
            farmId,
            assignmentId,
            userId,
        });
        return { ...this.mapAssignment(updated), plan_name: row.plan.name };
    }
    async removeAllForPlan(tx, farmId, userId, planId) {
        const res = await tx.feedPlanAssignment.updateMany({
            where: { farmId, planId, removedAt: null },
            data: { removedAt: new Date(), removedBy: userId },
        });
        return res.count;
    }
    async countActive(farmId, planId) {
        return this.prisma.feedPlanAssignment.count({
            where: { farmId, planId, removedAt: null },
        });
    }
    async appliedTo(farmId, planIds) {
        const out = new Map();
        if (planIds.length === 0)
            return out;
        const rows = await this.prisma.feedPlanAssignment.findMany({
            where: { farmId, planId: { in: planIds }, removedAt: null },
            select: {
                planId: true,
                targetType: true,
                cattleId: true,
                animalGroupId: true,
            },
        });
        for (const r of rows) {
            const e = out.get(r.planId) ?? {
                cattle_ids: [],
                group_ids: [],
                herd: false,
            };
            if (r.targetType === 'INDIVIDUAL' && r.cattleId)
                e.cattle_ids.push(r.cattleId);
            else if (r.targetType === 'GROUP' && r.animalGroupId)
                e.group_ids.push(r.animalGroupId);
            else if (r.targetType === 'HERD')
                e.herd = true;
            out.set(r.planId, e);
        }
        return out;
    }
    async list(farmId, query) {
        const rows = await this.prisma.feedPlanAssignment.findMany({
            where: {
                farmId,
                ...(query.cattleId ? { cattleId: query.cattleId } : {}),
                ...(query.animalGroupId ? { animalGroupId: query.animalGroupId } : {}),
                ...(query.planId ? { planId: query.planId } : {}),
                ...(query.status === 'ACTIVE' ? { removedAt: null } : {}),
                ...(query.status === 'ENDED' ? { removedAt: { not: null } } : {}),
            },
            include: { plan: { select: { name: true, kind: true } } },
            orderBy: [{ appliedAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((r) => ({
                ...this.mapAssignment(r),
                plan_name: r.plan.name,
                plan_kind: r.plan.kind,
            })),
            meta: page.meta,
        };
    }
    async resolveTargets(farmId, dto) {
        if (dto.targetType === 'HERD') {
            return [{ targetType: 'HERD', cattleId: null, animalGroupId: null }];
        }
        if (dto.targetType === 'GROUP') {
            const group = await this.prisma.animalGroup.findFirst({
                where: { id: dto.animalGroupId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!group)
                throw new common_1.NotFoundException('Animal group not found');
            return [{ targetType: 'GROUP', cattleId: null, animalGroupId: group.id }];
        }
        const ids = [...new Set(dto.cattleIds ?? [])];
        const found = await this.prisma.cattle.findMany({
            where: { ...(0, herd_scope_1.activeHerd)(farmId), id: { in: ids } },
            select: { id: true },
        });
        const missing = ids.filter((id) => !found.some((c) => c.id === id));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Cattle not found in the active herd: ${missing.join(', ')}`);
        }
        return found.map((c) => ({
            targetType: 'INDIVIDUAL',
            cattleId: c.id,
            animalGroupId: null,
        }));
    }
    targetWhere(t) {
        if (t.targetType === 'HERD')
            return { targetType: 'HERD' };
        if (t.targetType === 'GROUP')
            return { targetType: 'GROUP', animalGroupId: t.animalGroupId };
        return { targetType: 'INDIVIDUAL', cattleId: t.cattleId };
    }
    async assertNoGroupOverlap(farmId, groupId) {
        const members = await this.prisma.animalGroupMember.findMany({
            where: { farmId, groupId },
            select: { cattleId: true },
        });
        if (members.length === 0)
            return;
        const active = await this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                id: { in: members.map((m) => m.cattleId) },
            },
            select: { id: true },
        });
        const memberIds = active.map((c) => c.id);
        if (memberIds.length === 0)
            return;
        const [others, individual] = await Promise.all([
            this.prisma.animalGroupMember.findMany({
                where: {
                    farmId,
                    cattleId: { in: memberIds },
                    groupId: { not: groupId },
                },
                select: { cattleId: true, groupId: true },
            }),
            this.prisma.feedPlanAssignment.findMany({
                where: {
                    farmId,
                    removedAt: null,
                    targetType: 'INDIVIDUAL',
                    cattleId: { in: memberIds },
                },
                select: { cattleId: true },
            }),
        ]);
        if (others.length === 0)
            return;
        const groupAssignments = await this.prisma.feedPlanAssignment.findMany({
            where: {
                farmId,
                removedAt: null,
                targetType: 'GROUP',
                animalGroupId: { in: [...new Set(others.map((o) => o.groupId))] },
            },
            include: { plan: { select: { name: true } } },
        });
        const programByGroup = new Map(groupAssignments.map((a) => [
            a.animalGroupId,
            { plan_id: a.planId, plan_name: a.plan.name },
        ]));
        const hasOwn = new Set(individual.map((i) => i.cattleId));
        const conflicting = others
            .filter((o) => !hasOwn.has(o.cattleId) && programByGroup.has(o.groupId))
            .map((o) => ({
            cattle_id: o.cattleId,
            group_id: o.groupId,
            ...programByGroup.get(o.groupId),
        }));
        if (conflicting.length > 0) {
            throw new common_1.ConflictException({
                message: 'Some animals in this group are already on another group’s program. Remove that program, or give them an individual one, first.',
                details: { conflicting_cattle: conflicting },
            });
        }
    }
    mapAssignment(a) {
        return {
            id: a.id,
            plan_id: a.planId,
            target_type: a.targetType,
            cattle_id: a.cattleId,
            animal_group_id: a.animalGroupId,
            applied_at: a.appliedAt,
            applied_by: a.appliedBy,
            removed_at: a.removedAt,
            removed_by: a.removedBy,
        };
    }
    describe(dto, count) {
        if (dto.targetType === 'HERD')
            return 'the whole herd';
        if (dto.targetType === 'GROUP')
            return `group ${dto.animalGroupId}`;
        return `${count} animal${count === 1 ? '' : 's'}`;
    }
    describeRow(r) {
        if (r.targetType === 'HERD')
            return 'the whole herd';
        if (r.targetType === 'GROUP')
            return `group ${r.animalGroupId}`;
        return `animal ${r.cattleId}`;
    }
    async audit(farmId, actorId, eventTitle, actionDetails, relatedCattleId) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.INVENTORY,
                eventTitle,
                actionDetails,
                actorId,
                relatedCattleId,
            });
        }
        catch (err) {
            this.log.error('Feed program activity log failed', {
                farmId,
                eventTitle,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
exports.FeedPlanAssignmentService = FeedPlanAssignmentService;
exports.FeedPlanAssignmentService = FeedPlanAssignmentService = FeedPlanAssignmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_plan_resolver_service_1.FeedPlanResolverService,
        activity_log_service_1.ActivityLogService])
], FeedPlanAssignmentService);
//# sourceMappingURL=feed-plan-assignment.service.js.map