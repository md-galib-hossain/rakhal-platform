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
exports.FeedPlanAssignmentController = void 0;
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
const feed_plan_assignment_service_1 = require("../../application/services/feed-plan-assignment.service");
const feed_plan_dto_1 = require("../dto/feed-plan.dto");
let FeedPlanAssignmentController = class FeedPlanAssignmentController {
    assignments;
    constructor(assignments) {
        this.assignments = assignments;
    }
    list(farmId, query) {
        return this.assignments.list(farmId, query);
    }
    remove(farmId, userId, id) {
        return this.assignments.remove(farmId, userId, id);
    }
};
exports.FeedPlanAssignmentController = FeedPlanAssignmentController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, feed_plan_dto_1.ListPlanAssignmentsQueryDto]),
    __metadata("design:returntype", void 0)
], FeedPlanAssignmentController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/remove'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FeedPlanAssignmentController.prototype, "remove", null);
exports.FeedPlanAssignmentController = FeedPlanAssignmentController = __decorate([
    (0, swagger_1.ApiTags)('Feed'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('feed/plan-assignments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard, subscription_feature_guard_1.SubscriptionFeatureGuard),
    (0, require_feature_decorator_1.RequireFeature)('feed.formulator'),
    __metadata("design:paramtypes", [feed_plan_assignment_service_1.FeedPlanAssignmentService])
], FeedPlanAssignmentController);
//# sourceMappingURL=feed-plan-assignment.controller.js.map