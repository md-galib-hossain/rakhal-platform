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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const settings_service_1 = require("../../application/services/settings.service");
const update_farm_settings_dto_1 = require("../dto/update-farm-settings.dto");
const create_shed_dto_1 = require("../dto/create-shed.dto");
const update_shed_dto_1 = require("../dto/update-shed.dto");
const swagger_1 = require("@nestjs/swagger");
let SettingsController = class SettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    getFarm(farmId) {
        return this.settingsService.getFarm(farmId);
    }
    updateFarm(farmId, userId, dto) {
        return this.settingsService.updateFarm(farmId, userId, dto);
    }
    listSheds(farmId) {
        return this.settingsService.listSheds(farmId);
    }
    createShed(farmId, dto) {
        return this.settingsService.createShed(farmId, dto);
    }
    updateShed(farmId, id, dto) {
        return this.settingsService.updateShed(farmId, id, dto);
    }
    deleteShed(farmId, id) {
        return this.settingsService.deleteShed(farmId, id);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('farm'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getFarm", null);
__decorate([
    (0, common_1.Patch)('farm'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_farm_settings_dto_1.UpdateFarmSettingsDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateFarm", null);
__decorate([
    (0, common_1.Get)('sheds'),
    (0, require_permission_decorator_1.RequirePermission)('settings.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "listSheds", null);
__decorate([
    (0, common_1.Post)('sheds'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_shed_dto_1.CreateShedDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "createShed", null);
__decorate([
    (0, common_1.Patch)('sheds/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_shed_dto_1.UpdateShedDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateShed", null);
__decorate([
    (0, common_1.Delete)('sheds/:id'),
    (0, require_permission_decorator_1.RequirePermission)('settings.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "deleteShed", null);
exports.SettingsController = SettingsController = __decorate([
    (0, swagger_1.ApiTags)('Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map