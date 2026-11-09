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
exports.AdminOpsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_ops_service_1 = require("../../application/services/admin-ops.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_config_dto_1 = require("../dto/admin-config.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminOpsController = class AdminOpsController {
    ops;
    constructor(ops) {
        this.ops = ops;
    }
    queues() {
        return this.ops.listQueues();
    }
    failed(name, limit) {
        return this.ops.failedJobs(name, limit);
    }
    retry(admin, name, jobId, dto) {
        return this.ops.retryJob(admin.id, name, jobId, dto.reason);
    }
    emailStatus() {
        return this.ops.emailStatus();
    }
    integrations() {
        return this.ops.integrations();
    }
};
exports.AdminOpsController = AdminOpsController;
__decorate([
    (0, common_1.Get)('queues'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminOpsController.prototype, "queues", null);
__decorate([
    (0, common_1.Get)('queues/:name/failed'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.read'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], AdminOpsController.prototype, "failed", null);
__decorate([
    (0, common_1.Post)('queues/:name/failed/:jobId/retry'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('name')),
    __param(2, (0, common_1.Param)('jobId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, admin_config_dto_1.RetryJobDto]),
    __metadata("design:returntype", void 0)
], AdminOpsController.prototype, "retry", null);
__decorate([
    (0, common_1.Get)('email-status'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminOpsController.prototype, "emailStatus", null);
__decorate([
    (0, common_1.Get)('integrations'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminOpsController.prototype, "integrations", null);
exports.AdminOpsController = AdminOpsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Operations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/ops'),
    (0, decorators_1.ThrottleWrite)(),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_ops_service_1.AdminOpsService])
], AdminOpsController);
//# sourceMappingURL=admin-ops.controller.js.map