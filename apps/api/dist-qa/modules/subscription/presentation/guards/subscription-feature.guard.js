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
exports.SubscriptionFeatureGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const require_feature_decorator_1 = require("../decorators/require-feature.decorator");
const subscription_access_service_1 = require("../../application/services/subscription-access.service");
let SubscriptionFeatureGuard = class SubscriptionFeatureGuard {
    reflector;
    subscriptionAccessService;
    constructor(reflector, subscriptionAccessService) {
        this.reflector = reflector;
        this.subscriptionAccessService = subscriptionAccessService;
    }
    async canActivate(context) {
        const requiredFeatures = this.reflector.getAllAndOverride(require_feature_decorator_1.REQUIRED_FEATURES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? [];
        if (requiredFeatures.length === 0) {
            return true;
        }
        const request = context
            .switchToHttp()
            .getRequest();
        if (!request.farm) {
            throw new common_1.ForbiddenException('Feature is not enabled');
        }
        for (const feature of requiredFeatures) {
            await this.subscriptionAccessService.assertFeatureEnabled(request.farm.farmId, feature);
        }
        return true;
    }
};
exports.SubscriptionFeatureGuard = SubscriptionFeatureGuard;
exports.SubscriptionFeatureGuard = SubscriptionFeatureGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        subscription_access_service_1.SubscriptionAccessService])
], SubscriptionFeatureGuard);
//# sourceMappingURL=subscription-feature.guard.js.map