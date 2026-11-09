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
exports.RequirementOverrideController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const subscription_feature_guard_1 = require("src/modules/subscription/presentation/guards/subscription-feature.guard");
const require_feature_decorator_1 = require("src/modules/subscription/presentation/decorators/require-feature.decorator");
const requirement_override_service_1 = require("../../application/services/requirement-override.service");
const set_requirement_override_dto_1 = require("../dto/set-requirement-override.dto");
const requirement_override_history_query_dto_1 = require("../dto/requirement-override-history-query.dto");
let RequirementOverrideController = class RequirementOverrideController {
    overrides;
    constructor(overrides) {
        this.overrides = overrides;
    }
    get(farmId, cattleId) {
        return this.overrides.get(farmId, cattleId);
    }
    history(farmId, cattleId, query) {
        return this.overrides.history(farmId, cattleId, query);
    }
    set(farmId, userId, cattleId, dto) {
        return this.overrides.set(farmId, userId, cattleId, dto);
    }
    turnOff(farmId, userId, cattleId) {
        return this.overrides.turnOff(farmId, userId, cattleId);
    }
};
exports.RequirementOverrideController = RequirementOverrideController;
__decorate([
    (0, common_1.Get)('requirement-override'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RequirementOverrideController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('requirement-overrides'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, requirement_override_history_query_dto_1.RequirementOverrideHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], RequirementOverrideController.prototype, "history", null);
__decorate([
    (0, common_1.Put)('requirement-override'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('cattleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, set_requirement_override_dto_1.SetRequirementOverrideDto]),
    __metadata("design:returntype", void 0)
], RequirementOverrideController.prototype, "set", null);
__decorate([
    (0, common_1.Delete)('requirement-override'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('cattleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], RequirementOverrideController.prototype, "turnOff", null);
exports.RequirementOverrideController = RequirementOverrideController = __decorate([
    (0, swagger_1.ApiTags)('Feed'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('feed/cattle/:cattleId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard, subscription_feature_guard_1.SubscriptionFeatureGuard),
    (0, require_feature_decorator_1.RequireFeature)('feed.formulator'),
    __metadata("design:paramtypes", [requirement_override_service_1.RequirementOverrideService])
], RequirementOverrideController);
//# sourceMappingURL=requirement-override.controller.js.map