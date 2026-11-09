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
exports.AdminAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_analytics_service_1 = require("../../application/services/admin-analytics.service");
const admin_permission_matrix_1 = require("../../domain/admin-permission-matrix");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const common_2 = require("@nestjs/common");
var ExportKindParam;
(function (ExportKindParam) {
    ExportKindParam["farms"] = "farms";
    ExportKindParam["users"] = "users";
    ExportKindParam["subscriptions"] = "subscriptions";
})(ExportKindParam || (ExportKindParam = {}));
let AdminAnalyticsController = class AdminAnalyticsController {
    analytics;
    constructor(analytics) {
        this.analytics = analytics;
    }
    usage() {
        return this.analytics.usage();
    }
    async export(admin, kind, res) {
        const needed = kind === 'users' ? 'export.users' : 'export.farms';
        if (!(0, admin_permission_matrix_1.adminRoleHasPermission)(admin.role, needed)) {
            throw new common_2.ForbiddenException(`Admin role ${admin.role} lacks permission ${needed}`);
        }
        const { filename, csv } = await this.analytics.export(admin.id, kind);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(csv);
    }
};
exports.AdminAnalyticsController = AdminAnalyticsController;
__decorate([
    (0, common_1.Get)('analytics/usage'),
    (0, decorators_1.ThrottleExpensive)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('analytics.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminAnalyticsController.prototype, "usage", null);
__decorate([
    (0, common_1.Get)('exports/:kind'),
    (0, decorators_1.ThrottleExpensive)(),
    (0, require_admin_permission_decorator_1.AdminAuthenticatedOnly)(),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('kind', new common_1.ParseEnumPipe(ExportKindParam))),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminAnalyticsController.prototype, "export", null);
exports.AdminAnalyticsController = AdminAnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Analytics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_analytics_service_1.AdminAnalyticsService])
], AdminAnalyticsController);
//# sourceMappingURL=admin-analytics.controller.js.map