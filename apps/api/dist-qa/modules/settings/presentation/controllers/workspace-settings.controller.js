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
exports.WorkspaceSettingsController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const workspace_settings_service_1 = require("../../application/services/workspace-settings.service");
const create_supplier_dto_1 = require("../dto/create-supplier.dto");
const update_supplier_dto_1 = require("../dto/update-supplier.dto");
const create_service_provider_dto_1 = require("../dto/create-service-provider.dto");
const update_service_provider_dto_1 = require("../dto/update-service-provider.dto");
const update_module_settings_dto_1 = require("../dto/update-module-settings.dto");
const update_milk_sessions_dto_1 = require("../dto/update-milk-sessions.dto");
const swagger_1 = require("@nestjs/swagger");
let WorkspaceSettingsController = class WorkspaceSettingsController {
    workspace;
    constructor(workspace) {
        this.workspace = workspace;
    }
    getModules(farmId) {
        return this.workspace.getModules(farmId);
    }
    updateModules(farmId, dto) {
        return this.workspace.updateModules(farmId, dto);
    }
    updateMilkSessions(farmId, dto) {
        return this.workspace.updateMilkSessions(farmId, dto);
    }
    listSuppliers(farmId) {
        return this.workspace.listSuppliers(farmId);
    }
    createSupplier(farmId, userId, dto) {
        return this.workspace.createSupplier(farmId, dto, userId);
    }
    updateSupplier(farmId, userId, id, dto) {
        return this.workspace.updateSupplier(farmId, id, dto, userId);
    }
    deleteSupplier(farmId, userId, id) {
        return this.workspace.deleteSupplier(farmId, id, userId);
    }
    listServiceProviders(farmId) {
        return this.workspace.listServiceProviders(farmId);
    }
    createServiceProvider(farmId, dto) {
        return this.workspace.createServiceProvider(farmId, dto);
    }
    updateServiceProvider(farmId, id, dto) {
        return this.workspace.updateServiceProvider(farmId, id, dto);
    }
    deleteServiceProvider(farmId, id) {
        return this.workspace.deleteServiceProvider(farmId, id);
    }
    getBilling(farmId) {
        return this.workspace.getBilling(farmId);
    }
};
exports.WorkspaceSettingsController = WorkspaceSettingsController;
__decorate([
    (0, common_1.Get)('modules'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "getModules", null);
__decorate([
    (0, common_1.Patch)('modules'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_module_settings_dto_1.UpdateModuleSettingsDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "updateModules", null);
__decorate([
    (0, common_1.Patch)('modules/milk-sessions'),
    (0, require_permission_decorator_1.RequirePermission)('settings.milk-sessions-manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_milk_sessions_dto_1.UpdateMilkSessionsDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "updateMilkSessions", null);
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "listSuppliers", null);
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Patch)('suppliers/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_supplier_dto_1.UpdateSupplierDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "updateSupplier", null);
__decorate([
    (0, common_1.Delete)('suppliers/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "deleteSupplier", null);
__decorate([
    (0, common_1.Get)('service-providers'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "listServiceProviders", null);
__decorate([
    (0, common_1.Post)('service-providers'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_service_provider_dto_1.CreateServiceProviderDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "createServiceProvider", null);
__decorate([
    (0, common_1.Patch)('service-providers/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_service_provider_dto_1.UpdateServiceProviderDto]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "updateServiceProvider", null);
__decorate([
    (0, common_1.Delete)('service-providers/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "deleteServiceProvider", null);
__decorate([
    (0, common_1.Get)('billing'),
    (0, require_permission_decorator_1.RequirePermission)('settings.billing'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkspaceSettingsController.prototype, "getBilling", null);
exports.WorkspaceSettingsController = WorkspaceSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [workspace_settings_service_1.WorkspaceSettingsService])
], WorkspaceSettingsController);
//# sourceMappingURL=workspace-settings.controller.js.map