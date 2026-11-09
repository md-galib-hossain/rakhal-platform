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
exports.AdminSubscriptionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_subscriptions_service_1 = require("../../application/services/admin-subscriptions.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_subscription_dto_1 = require("../dto/admin-subscription.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminSubscriptionsController = class AdminSubscriptionsController {
    subs;
    constructor(subs) {
        this.subs = subs;
    }
    matrix() {
        return this.subs.matrix();
    }
    updatePlan(admin, id, dto) {
        return this.subs.updatePlan(admin.id, id, dto);
    }
    setFeature(admin, id, key, dto) {
        return this.subs.setPlanFeature(admin.id, id, key, dto);
    }
    activate(admin, id, dto) {
        return this.subs.activate(admin.id, id, dto);
    }
    comp(admin, id, dto) {
        return this.subs.comp(admin.id, id, dto);
    }
    extend(admin, id, dto) {
        return this.subs.extend(admin.id, id, dto);
    }
    cancel(admin, id, dto) {
        return this.subs.cancel(admin.id, id, dto);
    }
};
exports.AdminSubscriptionsController = AdminSubscriptionsController;
__decorate([
    (0, common_1.Get)('plans/matrix'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('plan.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "matrix", null);
__decorate([
    (0, common_1.Patch)('plans/:id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('plan.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_subscription_dto_1.UpdatePlanDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Put)('plans/:id/features/:key'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('plan.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('key')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, admin_subscription_dto_1.SetPlanFeatureDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "setFeature", null);
__decorate([
    (0, common_1.Post)('farms/:id/subscription/activate'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('subscription.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_subscription_dto_1.ActivateSubscriptionDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)('farms/:id/subscription/comp'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('subscription.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_subscription_dto_1.CompSubscriptionDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "comp", null);
__decorate([
    (0, common_1.Post)('farms/:id/subscription/extend'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('subscription.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_subscription_dto_1.ExtendSubscriptionDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "extend", null);
__decorate([
    (0, common_1.Post)('farms/:id/subscription/cancel'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('subscription.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_subscription_dto_1.SubscriptionActionDto]),
    __metadata("design:returntype", void 0)
], AdminSubscriptionsController.prototype, "cancel", null);
exports.AdminSubscriptionsController = AdminSubscriptionsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Commercial'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, decorators_1.ThrottleWrite)(),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_subscriptions_service_1.AdminSubscriptionsService])
], AdminSubscriptionsController);
//# sourceMappingURL=admin-subscriptions.controller.js.map