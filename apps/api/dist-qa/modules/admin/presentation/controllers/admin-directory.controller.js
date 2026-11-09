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
exports.AdminDirectoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_directory_service_1 = require("../../application/services/admin-directory.service");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_directory_dto_1 = require("../dto/admin-directory.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
let AdminDirectoryController = class AdminDirectoryController {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    overview() {
        return this.directory.overview();
    }
    listFarms(query) {
        return this.directory.listFarms(query);
    }
    getFarm(id) {
        return this.directory.getFarm(id);
    }
    listUsers(query) {
        return this.directory.listUsers(query);
    }
    getUser(id) {
        return this.directory.getUser(id);
    }
};
exports.AdminDirectoryController = AdminDirectoryController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, require_admin_permission_decorator_1.AdminAuthenticatedOnly)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminDirectoryController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('farms'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('farm.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_directory_dto_1.ListAdminFarmsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminDirectoryController.prototype, "listFarms", null);
__decorate([
    (0, common_1.Get)('farms/:id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('farm.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminDirectoryController.prototype, "getFarm", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_directory_dto_1.ListAdminUsersQueryDto]),
    __metadata("design:returntype", void 0)
], AdminDirectoryController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('user.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminDirectoryController.prototype, "getUser", null);
exports.AdminDirectoryController = AdminDirectoryController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Directory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_directory_service_1.AdminDirectoryService])
], AdminDirectoryController);
//# sourceMappingURL=admin-directory.controller.js.map