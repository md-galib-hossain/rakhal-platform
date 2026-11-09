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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SubscriptionAccessService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionAccessService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const ENTITLEMENT_TTL_SECONDS = 300;
const USABLE_STATUSES = new Set([
    client_1.SubscriptionStatus.ACTIVE,
    client_1.SubscriptionStatus.TRIALING,
    client_1.SubscriptionStatus.PAST_DUE,
]);
const NONE_ENTITLEMENT = {
    status: 'NONE',
    planId: null,
    planName: null,
    expiresAt: null,
    features: [],
    limits: { maxCattle: null, maxFarmMembers: null },
};
let SubscriptionAccessService = SubscriptionAccessService_1 = class SubscriptionAccessService {
    prisma;
    redis;
    logger;
    log;
    constructor(prisma, redis, logger) {
        this.prisma = prisma;
        this.redis = redis;
        this.logger = logger;
        this.log = this.logger.setContext(SubscriptionAccessService_1.name);
    }
    cacheKey(farmId) {
        return `auth:entitlement:${farmId}`;
    }
    async resolveEntitlement(farmId) {
        const key = this.cacheKey(farmId);
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch {
        }
        const sub = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
            include: {
                subscriptionPlan: {
                    include: {
                        features: {
                            where: { enabled: true },
                            include: { feature: { select: { key: true } } },
                        },
                    },
                },
            },
        });
        let entitlement;
        if (!sub) {
            entitlement = NONE_ENTITLEMENT;
        }
        else {
            const usable = USABLE_STATUSES.has(sub.status);
            entitlement = {
                status: sub.status,
                planId: sub.subscriptionPlanId,
                planName: sub.subscriptionPlan.name,
                expiresAt: sub.expiresAt ? sub.expiresAt.toISOString() : null,
                features: usable
                    ? sub.subscriptionPlan.features.map((pf) => pf.feature.key)
                    : [],
                limits: {
                    maxCattle: sub.subscriptionPlan.maxCattle,
                    maxFarmMembers: sub.subscriptionPlan.maxFarmMembers,
                },
            };
        }
        try {
            await this.redis.set(key, JSON.stringify(entitlement), {
                EX: ENTITLEMENT_TTL_SECONDS,
            });
        }
        catch {
        }
        return entitlement;
    }
    async resolveActivePlanFeatures(farmId) {
        return (await this.resolveEntitlement(farmId)).features;
    }
    async assertFeatureEnabled(farmId, featureKey) {
        const features = await this.resolveActivePlanFeatures(farmId);
        if (!features.includes(featureKey)) {
            this.log.warn('Subscription feature denied', { farmId, featureKey });
            throw new common_1.ForbiddenException('Feature is not enabled');
        }
    }
    assertMemberLimit(farmId, limit, currentUsage) {
        if (limit === null || limit === undefined) {
            return;
        }
        if (currentUsage > limit) {
            this.log.warn('Subscription limit exceeded', {
                farmId,
                limit,
                currentUsage,
            });
            throw new common_1.ForbiddenException('Plan limit exceeded');
        }
    }
    async assertCattleLimit(farmId, currentActiveCount) {
        const { limits } = await this.resolveEntitlement(farmId);
        if (limits.maxCattle !== null && currentActiveCount >= limits.maxCattle) {
            this.log.warn('Cattle limit reached', {
                farmId,
                limit: limits.maxCattle,
                current: currentActiveCount,
            });
            throw new common_1.ForbiddenException(`Plan limit reached: up to ${limits.maxCattle} cattle. Upgrade to add more.`);
        }
    }
    async assertMemberSeatAvailable(farmId, currentMemberCount) {
        const { limits } = await this.resolveEntitlement(farmId);
        if (limits.maxFarmMembers !== null &&
            currentMemberCount >= limits.maxFarmMembers) {
            this.log.warn('Member seat limit reached', {
                farmId,
                limit: limits.maxFarmMembers,
                current: currentMemberCount,
            });
            throw new common_1.ForbiddenException(`Plan limit reached: up to ${limits.maxFarmMembers} team members. Upgrade to add more.`);
        }
    }
    async invalidateFarm(farmId) {
        try {
            await this.redis.del(this.cacheKey(farmId));
        }
        catch {
        }
    }
};
exports.SubscriptionAccessService = SubscriptionAccessService;
exports.SubscriptionAccessService = SubscriptionAccessService = SubscriptionAccessService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], SubscriptionAccessService);
//# sourceMappingURL=subscription-access.service.js.map