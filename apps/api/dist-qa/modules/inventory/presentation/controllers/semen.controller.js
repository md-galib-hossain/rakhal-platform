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
exports.SemenController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const semen_service_1 = require("../../application/services/semen.service");
const semen_tank_dto_1 = require("../dto/semen-tank.dto");
const semen_batch_dto_1 = require("../dto/semen-batch.dto");
const swagger_1 = require("@nestjs/swagger");
let SemenController = class SemenController {
    semenService;
    constructor(semenService) {
        this.semenService = semenService;
    }
    listTanks(farmId) {
        return this.semenService.listTanks(farmId);
    }
    createTank(farmId, userId, dto) {
        return this.semenService.createTank(farmId, userId, dto);
    }
    updateTank(farmId, userId, id, dto) {
        return this.semenService.updateTank(farmId, id, dto, userId);
    }
    archiveTank(farmId, userId, id) {
        return this.semenService.archiveTank(farmId, id, userId);
    }
    listBatches(farmId, query) {
        return this.semenService.listBatches(farmId, query);
    }
    createBatch(farmId, userId, dto) {
        return this.semenService.createBatch(farmId, userId, dto);
    }
    updateBatch(farmId, userId, id, dto) {
        return this.semenService.updateBatch(farmId, id, dto, userId);
    }
    archiveBatch(farmId, userId, id) {
        return this.semenService.archiveBatch(farmId, id, userId);
    }
};
exports.SemenController = SemenController;
__decorate([
    (0, common_1.Get)('tanks'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "listTanks", null);
__decorate([
    (0, common_1.Post)('tanks'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, semen_tank_dto_1.CreateSemenTankDto]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "createTank", null);
__decorate([
    (0, common_1.Patch)('tanks/:id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, semen_tank_dto_1.UpdateSemenTankDto]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "updateTank", null);
__decorate([
    (0, common_1.Delete)('tanks/:id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "archiveTank", null);
__decorate([
    (0, common_1.Get)('batches'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, semen_batch_dto_1.ListSemenBatchQueryDto]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "listBatches", null);
__decorate([
    (0, common_1.Post)('batches'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, semen_batch_dto_1.CreateSemenBatchDto]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Patch)('batches/:id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, semen_batch_dto_1.UpdateSemenBatchDto]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "updateBatch", null);
__decorate([
    (0, common_1.Delete)('batches/:id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SemenController.prototype, "archiveBatch", null);
exports.SemenController = SemenController = __decorate([
    (0, swagger_1.ApiTags)('Inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('inventory/semen'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [semen_service_1.SemenService])
], SemenController);
//# sourceMappingURL=semen.controller.js.map