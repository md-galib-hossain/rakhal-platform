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
exports.SubscriptionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const skip_subscription_decorator_1 = require("../decorators/skip-subscription.decorator");
const subscription_access_service_1 = require("../../application/services/subscription-access.service");
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
let SubscriptionGuard = class SubscriptionGuard {
    reflector;
    access;
    constructor(reflector, access) {
        this.reflector = reflector;
        this.access = access;
    }
    async canActivate(context) {
        const skip = this.reflector.getAllAndOverride(skip_subscription_decorator_1.SKIP_SUBSCRIPTION_KEY, [context.getHandler(), context.getClass()]);
        if (skip) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        if (!req.farm) {
            return true;
        }
        const entitlement = req.entitlement ??
            (req.entitlement = await this.access.resolveEntitlement(req.farm.farmId));
        if (entitlement.status === 'ACTIVE' || entitlement.status === 'TRIALING') {
            return true;
        }
        if (SAFE_METHODS.has(req.method)) {
            return true;
        }
        throw new common_1.ForbiddenException(this.blockMessage(entitlement.status));
    }
    blockMessage(status) {
        switch (status) {
            case 'PAST_DUE':
                return 'Subscription payment is past due — renew to make changes.';
            case 'EXPIRED':
                return 'Subscription has expired — renew to make changes.';
            case 'CANCELLED':
                return 'Subscription is cancelled — resubscribe to make changes.';
            default:
                return 'An active subscription is required to make changes.';
        }
    }
};
exports.SubscriptionGuard = SubscriptionGuard;
exports.SubscriptionGuard = SubscriptionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        subscription_access_service_1.SubscriptionAccessService])
], SubscriptionGuard);
//# sourceMappingURL=subscription.guard.js.map