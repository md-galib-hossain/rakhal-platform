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
exports.RolesController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const roles_service_1 = require("../../application/services/roles.service");
const create_role_dto_1 = require("../dto/create-role.dto");
const update_role_permissions_dto_1 = require("../dto/update-role-permissions.dto");
const swagger_1 = require("@nestjs/swagger");
let RolesController = class RolesController {
    rolesService;
    constructor(rolesService) {
        this.rolesService = rolesService;
    }
    getCatalogue() {
        return this.rolesService.getCatalogue();
    }
    listRoles(farmId) {
        return this.rolesService.listRoles(farmId);
    }
    createRole(farmId, userId, dto) {
        return this.rolesService.createRole(farmId, userId, dto);
    }
    updateRolePermissions(farmId, userId, id, dto) {
        return this.rolesService.updateRolePermissions(farmId, userId, id, dto);
    }
    deleteRole(farmId, userId, id) {
        return this.rolesService.deleteRole(farmId, userId, id);
    }
};
exports.RolesController = RolesController;
__decorate([
    (0, common_1.Get)('permissions'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "getCatalogue", null);
__decorate([
    (0, common_1.Get)('roles'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Post)('roles'),
    (0, require_permission_decorator_1.RequirePermission)('settings.roles-manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_role_dto_1.CreateRoleDto]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "createRole", null);
__decorate([
    (0, common_1.Patch)('roles/:id/permissions'),
    (0, require_permission_decorator_1.RequirePermission)('settings.roles-manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_role_permissions_dto_1.UpdateRolePermissionsDto]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "updateRolePermissions", null);
__decorate([
    (0, common_1.Delete)('roles/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.roles-manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "deleteRole", null);
exports.RolesController = RolesController = __decorate([
    (0, swagger_1.ApiTags)('Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [roles_service_1.RolesService])
], RolesController);
//# sourceMappingURL=roles.controller.js.map