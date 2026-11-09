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
exports.AdminSubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const subscription_access_service_1 = require("src/modules/subscription/application/services/subscription-access.service");
const subscription_lifecycle_service_1 = require("src/modules/subscription/application/services/subscription-lifecycle.service");
const admin_audit_service_1 = require("./admin-audit.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const planSnapshot = (p) => ({
    description: p.description,
    monthlyPrice: p.monthlyPrice.toString(),
    yearlyPrice: p.yearlyPrice?.toString() ?? null,
    maxCattle: p.maxCattle,
    maxFarmMembers: p.maxFarmMembers,
});
let AdminSubscriptionsService = class AdminSubscriptionsService {
    prisma;
    lifecycle;
    access;
    audit;
    constructor(prisma, lifecycle, access, audit) {
        this.prisma = prisma;
        this.lifecycle = lifecycle;
        this.access = access;
        this.audit = audit;
    }
    async matrix() {
        const [plans, features, latest] = await Promise.all([
            this.prisma.subscriptionPlan.findMany({
                orderBy: [{ monthlyPrice: 'asc' }, { id: 'asc' }],
                include: {
                    features: {
                        select: { enabled: true, feature: { select: { key: true } } },
                    },
                },
            }),
            this.prisma.feature.findMany({ orderBy: { key: 'asc' } }),
            this.prisma.$queryRaw `
        SELECT "subscriptionPlanId" AS "planId", count(*) AS n
        FROM (
          SELECT DISTINCT ON ("farmId") "subscriptionPlanId"
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) latest
        GROUP BY 1`,
        ]);
        const farmsByPlan = new Map(latest.map((r) => [r.planId, Number(r.n)]));
        return {
            features,
            plans: plans.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                monthlyPrice: p.monthlyPrice.toNumber(),
                yearlyPrice: p.yearlyPrice?.toNumber() ?? null,
                maxCattle: p.maxCattle,
                maxFarmMembers: p.maxFarmMembers,
                farmCount: farmsByPlan.get(p.id) ?? 0,
                enabledFeatures: p.features
                    .filter((f) => f.enabled)
                    .map((f) => f.feature.key),
            })),
        };
    }
    async updatePlan(actorId, id, dto) {
        const before = await this.getPlan(id);
        const data = {
            ...(dto.description !== undefined
                ? { description: dto.description }
                : {}),
            ...(dto.monthlyPrice !== undefined
                ? { monthlyPrice: dto.monthlyPrice }
                : {}),
            ...(dto.yearlyPrice !== undefined
                ? { yearlyPrice: dto.yearlyPrice }
                : {}),
            ...(dto.maxCattle !== undefined ? { maxCattle: dto.maxCattle } : {}),
            ...(dto.maxFarmMembers !== undefined
                ? { maxFarmMembers: dto.maxFarmMembers }
                : {}),
        };
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException('Nothing to change');
        }
        const plan = await this.prisma.subscriptionPlan.update({
            where: { id },
            data,
        });
        await this.invalidatePlanFarms(id);
        await this.audit.record({
            adminId: actorId,
            action: 'PLAN_UPDATED',
            entityType: 'SubscriptionPlan',
            entityId: id,
            before: planSnapshot(before),
            after: planSnapshot(plan),
            metadata: { reason: dto.reason, plan: plan.name },
        });
        return plan;
    }
    async setPlanFeature(actorId, planId, featureKey, dto) {
        const plan = await this.getPlan(planId);
        const feature = await this.prisma.feature.findUnique({
            where: { key: featureKey },
        });
        if (!feature)
            throw new common_1.NotFoundException('Feature not found');
        const existing = await this.prisma.subscriptionFeature.findUnique({
            where: {
                subscriptionPlanId_featureId: {
                    subscriptionPlanId: planId,
                    featureId: feature.id,
                },
            },
        });
        const wasEnabled = existing?.enabled ?? false;
        await this.prisma.subscriptionFeature.upsert({
            where: {
                subscriptionPlanId_featureId: {
                    subscriptionPlanId: planId,
                    featureId: feature.id,
                },
            },
            create: {
                subscriptionPlanId: planId,
                featureId: feature.id,
                enabled: dto.enabled,
            },
            update: { enabled: dto.enabled },
        });
        await this.invalidatePlanFarms(planId);
        await this.audit.record({
            adminId: actorId,
            action: 'PLAN_FEATURE_SET',
            entityType: 'SubscriptionPlan',
            entityId: planId,
            before: { feature: featureKey, enabled: wasEnabled },
            after: { feature: featureKey, enabled: dto.enabled },
            metadata: { reason: dto.reason, plan: plan.name },
        });
        return {
            planId,
            feature: featureKey,
            enabled: dto.enabled,
            changed: wasEnabled !== dto.enabled,
        };
    }
    async activate(actorId, farmId, dto) {
        const farm = await this.farm(farmId, dto);
        const plan = await this.getPlan(dto.planId);
        const before = await this.latest(farmId);
        const sub = await this.lifecycle.activate(farmId, plan.id, dto.period);
        await this.record(actorId, 'SUBSCRIPTION_ACTIVATED', farm, before, sub, plan.name, dto.reason, {
            period: dto.period,
        });
        return this.view(sub, plan.name);
    }
    async comp(actorId, farmId, dto) {
        const farm = await this.farm(farmId, dto);
        const plan = await this.getPlan(dto.planId);
        const before = await this.latest(farmId);
        const now = new Date();
        const sub = await this.prisma.farmSubscription.create({
            data: {
                farmId,
                subscriptionPlanId: plan.id,
                status: client_1.SubscriptionStatus.ACTIVE,
                startsAt: now,
                expiresAt: new Date(now.getTime() + dto.days * DAY_MS),
            },
        });
        await this.access.invalidateFarm(farmId);
        await this.record(actorId, 'SUBSCRIPTION_COMPED', farm, before, sub, plan.name, dto.reason, {
            days: dto.days,
        });
        return this.view(sub, plan.name);
    }
    async extend(actorId, farmId, dto) {
        const farm = await this.farm(farmId, dto);
        const current = await this.latest(farmId);
        if (!current)
            throw new common_1.ConflictException('This farm has no subscription to extend');
        if (current.status === client_1.SubscriptionStatus.CANCELLED) {
            throw new common_1.ConflictException('A cancelled subscription cannot be extended; activate a plan instead');
        }
        const now = Date.now();
        const from = Math.max(now, current.expiresAt?.getTime() ?? now);
        const revive = current.status === client_1.SubscriptionStatus.EXPIRED ||
            current.status === client_1.SubscriptionStatus.PAST_DUE;
        const sub = await this.prisma.farmSubscription.update({
            where: { id: current.id },
            data: {
                expiresAt: new Date(from + dto.days * DAY_MS),
                ...(revive ? { status: client_1.SubscriptionStatus.ACTIVE } : {}),
            },
        });
        await this.access.invalidateFarm(farmId);
        const plan = await this.getPlan(sub.subscriptionPlanId);
        await this.record(actorId, 'SUBSCRIPTION_EXTENDED', farm, current, sub, plan.name, dto.reason, {
            days: dto.days,
        });
        return this.view(sub, plan.name);
    }
    async cancel(actorId, farmId, dto) {
        const farm = await this.farm(farmId, dto);
        const current = await this.latest(farmId);
        if (!current)
            throw new common_1.ConflictException('This farm has no subscription to cancel');
        if (current.status === client_1.SubscriptionStatus.CANCELLED) {
            return this.view(current, (await this.getPlan(current.subscriptionPlanId)).name, false);
        }
        const sub = await this.prisma.farmSubscription.update({
            where: { id: current.id },
            data: { status: client_1.SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
        });
        await this.access.invalidateFarm(farmId);
        const plan = await this.getPlan(sub.subscriptionPlanId);
        await this.record(actorId, 'SUBSCRIPTION_CANCELLED', farm, current, sub, plan.name, dto.reason, {});
        return this.view(sub, plan.name);
    }
    async farm(id, dto) {
        const farm = await this.prisma.farm.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, name: true },
        });
        if (!farm)
            throw new common_1.NotFoundException('Farm not found');
        if (dto.confirm.trim() !== farm.name) {
            throw new common_1.BadRequestException('Confirmation does not match the farm name');
        }
        return farm;
    }
    latest(farmId) {
        return this.prisma.farmSubscription.findFirst({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getPlan(id) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id },
        });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        return plan;
    }
    async invalidatePlanFarms(planId) {
        const rows = await this.prisma.farmSubscription.findMany({
            where: { subscriptionPlanId: planId },
            distinct: ['farmId'],
            select: { farmId: true },
        });
        await Promise.all(rows.map((r) => this.access.invalidateFarm(r.farmId)));
    }
    async record(actorId, action, farm, before, after, planName, reason, extra) {
        const beforePlan = before
            ? (await this.getPlan(before.subscriptionPlanId)).name
            : null;
        await this.audit.record({
            adminId: actorId,
            action,
            entityType: 'Farm',
            entityId: farm.id,
            before: before
                ? {
                    plan: beforePlan,
                    status: before.status,
                    expiresAt: before.expiresAt,
                }
                : null,
            after: {
                plan: planName,
                status: after.status,
                expiresAt: after.expiresAt,
            },
            metadata: { reason, farmName: farm.name, manual: true, ...extra },
        });
    }
    view(sub, plan, changed = true) {
        return {
            farmId: sub.farmId,
            plan,
            status: sub.status,
            startsAt: sub.startsAt,
            expiresAt: sub.expiresAt,
            cancelledAt: sub.cancelledAt,
            changed,
        };
    }
};
exports.AdminSubscriptionsService = AdminSubscriptionsService;
exports.AdminSubscriptionsService = AdminSubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        subscription_lifecycle_service_1.SubscriptionLifecycleService,
        subscription_access_service_1.SubscriptionAccessService,
        admin_audit_service_1.AdminAuditService])
], AdminSubscriptionsService);
//# sourceMappingURL=admin-subscriptions.service.js.map