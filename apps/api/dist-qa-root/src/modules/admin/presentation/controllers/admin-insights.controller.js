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
exports.AdminInsightsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_insights_service_1 = require("../../application/services/admin-insights.service");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminInsightsController = class AdminInsightsController {
    insights;
    constructor(insights) {
        this.insights = insights;
    }
    engagement() {
        return this.insights.engagement();
    }
    security() {
        return this.insights.security();
    }
};
exports.AdminInsightsController = AdminInsightsController;
__decorate([
    (0, common_1.Get)('analytics/engagement'),
    (0, decorators_1.ThrottleExpensive)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('analytics.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminInsightsController.prototype, "engagement", null);
__decorate([
    (0, common_1.Get)('security/overview'),
    (0, decorators_1.ThrottleExpensive)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('security.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminInsightsController.prototype, "security", null);
exports.AdminInsightsController = AdminInsightsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Insights'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_insights_service_1.AdminInsightsService])
], AdminInsightsController);
//# sourceMappingURL=admin-insights.controller.js.map