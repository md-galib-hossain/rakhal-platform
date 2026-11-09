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
exports.AdminConfigController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const admin_platform_config_service_1 = require("../../application/services/admin-platform-config.service");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_config_dto_1 = require("../dto/admin-config.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminConfigController = class AdminConfigController {
    config;
    constructor(config) {
        this.config = config;
    }
    listFlags() {
        return this.config.listFlags();
    }
    createFlag(admin, dto) {
        return this.config.createFlag(admin.id, dto);
    }
    updateFlag(admin, key, dto) {
        return this.config.updateFlag(admin.id, key, dto);
    }
    deleteFlag(admin, key, dto) {
        return this.config.deleteFlag(admin.id, key, dto.reason);
    }
    listSettings() {
        return this.config.listSettings();
    }
    setSetting(admin, key, dto) {
        return this.config.setSetting(admin.id, key, dto);
    }
};
exports.AdminConfigController = AdminConfigController;
__decorate([
    (0, common_1.Get)('flags'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "listFlags", null);
__decorate([
    (0, common_1.Post)('flags'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_config_dto_1.CreateFlagDto]),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "createFlag", null);
__decorate([
    (0, common_1.Patch)('flags/:key'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_config_dto_1.UpdateFlagDto]),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "updateFlag", null);
__decorate([
    (0, common_1.Delete)('flags/:key'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_config_dto_1.ConfigReasonDto]),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "deleteFlag", null);
__decorate([
    (0, common_1.Get)('settings'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "listSettings", null);
__decorate([
    (0, common_1.Put)('settings/:key'),
    (0, common_1.HttpCode)(200),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('config.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, admin_config_dto_1.SetSettingDto]),
    __metadata("design:returntype", void 0)
], AdminConfigController.prototype, "setSetting", null);
exports.AdminConfigController = AdminConfigController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Platform config'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/config'),
    (0, decorators_1.ThrottleWrite)(),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_platform_config_service_1.AdminPlatformConfigService])
], AdminConfigController);
//# sourceMappingURL=admin-config.controller.js.map