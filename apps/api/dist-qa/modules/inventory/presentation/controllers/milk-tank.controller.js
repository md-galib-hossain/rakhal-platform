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
exports.MilkTankController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const milk_tank_service_1 = require("../../application/services/milk-tank.service");
const milk_tank_dto_1 = require("../dto/milk-tank.dto");
const swagger_1 = require("@nestjs/swagger");
let MilkTankController = class MilkTankController {
    milkTankService;
    constructor(milkTankService) {
        this.milkTankService = milkTankService;
    }
    auditLog(farmId, query) {
        return this.milkTankService.auditLog(farmId, query);
    }
    findAll(farmId, query) {
        return this.milkTankService.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.milkTankService.findOne(farmId, id);
    }
    create(farmId, userId, dto) {
        return this.milkTankService.create(farmId, userId, dto);
    }
    update(farmId, userId, id, dto) {
        return this.milkTankService.update(farmId, id, dto, userId);
    }
    setPrimary(farmId, userId, id) {
        return this.milkTankService.setPrimary(farmId, id, userId);
    }
    adjustVolume(farmId, userId, id, dto) {
        return this.milkTankService.adjustVolumeManual(farmId, userId, id, dto);
    }
    archive(farmId, userId, id) {
        return this.milkTankService.archive(farmId, id, userId);
    }
};
exports.MilkTankController = MilkTankController;
__decorate([
    (0, common_1.Get)('audit-log'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_tank_dto_1.ListMilkTankAuditQueryDto]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "auditLog", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_tank_dto_1.ListMilkTankQueryDto]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, milk_tank_dto_1.CreateMilkTankDto]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, milk_tank_dto_1.UpdateMilkTankDto]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/set-primary'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "setPrimary", null);
__decorate([
    (0, common_1.Post)(':id/adjust-volume'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, milk_tank_dto_1.AdjustMilkTankVolumeDto]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "adjustVolume", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MilkTankController.prototype, "archive", null);
exports.MilkTankController = MilkTankController = __decorate([
    (0, swagger_1.ApiTags)('Inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('inventory/milk-tanks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [milk_tank_service_1.MilkTankService])
], MilkTankController);
//# sourceMappingURL=milk-tank.controller.js.map