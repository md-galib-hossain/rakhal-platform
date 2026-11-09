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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const subscription_access_service_1 = require("../../application/services/subscription-access.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const swagger_1 = require("@nestjs/swagger");
let SubscriptionController = class SubscriptionController {
    access;
    prisma;
    constructor(access, prisma) {
        this.access = access;
        this.prisma = prisma;
    }
    async get(farmId) {
        const [e, cattle, members, current] = await Promise.all([
            this.access.resolveEntitlement(farmId),
            this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(farmId),
            }),
            this.prisma.farmMember.count({ where: { farmId } }),
            this.prisma.farmSubscription.findFirst({
                where: { farmId },
                orderBy: { createdAt: 'desc' },
                include: { pendingPlan: { select: { id: true, name: true } } },
            }),
        ]);
        return {
            status: e.status,
            plan_id: e.planId,
            plan_name: e.planName,
            expires_at: e.expiresAt,
            features: e.features,
            limits: {
                max_cattle: e.limits.maxCattle,
                max_farm_members: e.limits.maxFarmMembers,
            },
            usage: { cattle, farm_members: members },
            pending_plan_id: current?.pendingPlan?.id ?? null,
            pending_plan_name: current?.pendingPlan?.name ?? null,
            pending_effective_at: current?.pendingPlan
                ? (current.expiresAt?.toISOString() ?? null)
                : null,
        };
    }
};
exports.SubscriptionController = SubscriptionController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "get", null);
exports.SubscriptionController = SubscriptionController = __decorate([
    (0, swagger_1.ApiTags)('Subscription'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('subscription'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard),
    __metadata("design:paramtypes", [subscription_access_service_1.SubscriptionAccessService,
        prisma_service_1.PrismaService])
], SubscriptionController);
//# sourceMappingURL=subscription.controller.js.map