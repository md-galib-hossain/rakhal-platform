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
exports.AdminAdminsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_management_service_1 = require("../../application/services/admin-management.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_lifecycle_dto_1 = require("../dto/admin-lifecycle.dto");
const list_admins_dto_1 = require("../dto/list-admins.dto");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminAdminsController = class AdminAdminsController {
    admins;
    constructor(admins) {
        this.admins = admins;
    }
    list(query) {
        return this.admins.list(query);
    }
    get(id) {
        return this.admins.get(id);
    }
    create(actor, dto) {
        return this.admins.create(actor.id, dto);
    }
    update(actor, id, dto) {
        return this.admins.update(actor.id, id, dto);
    }
    deactivate(actor, id) {
        return this.admins.deactivate(actor.id, id);
    }
    activate(actor, id) {
        return this.admins.activate(actor.id, id);
    }
    resetTwoFactor(actor, id) {
        return this.admins.resetTwoFactor(actor.id, id);
    }
    resetPassword(actor, id) {
        return this.admins.resetPassword(actor.id, id);
    }
};
exports.AdminAdminsController = AdminAdminsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_admins_dto_1.ListAdminsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_lifecycle_dto_1.CreateAdminDto]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_lifecycle_dto_1.UpdateAdminDto]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':id/reset-2fa'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "resetTwoFactor", null);
__decorate([
    (0, common_1.Post)(':id/reset-password'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('admin.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminAdminsController.prototype, "resetPassword", null);
exports.AdminAdminsController = AdminAdminsController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Admins'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/admins'),
    (0, decorators_1.ThrottleWrite)(),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_management_service_1.AdminManagementService])
], AdminAdminsController);
//# sourceMappingURL=admin-admins.controller.js.map