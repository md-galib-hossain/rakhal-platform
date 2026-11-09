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
exports.MedicineController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const env_1 = require("src/core/config/env");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const medicine_service_1 = require("../../application/services/medicine.service");
const adjust_stock_dto_1 = require("../dto/adjust-stock.dto");
const bulk_delete_medicine_dto_1 = require("../dto/bulk-delete-medicine.dto");
const create_medicine_batch_dto_1 = require("../dto/create-medicine-batch.dto");
const create_medicine_dto_1 = require("../dto/create-medicine.dto");
const list_medicine_query_dto_1 = require("../dto/list-medicine-query.dto");
const medicine_by_batch_code_query_dto_1 = require("../dto/medicine-by-batch-code-query.dto");
const update_medicine_dto_1 = require("../dto/update-medicine.dto");
const swagger_1 = require("@nestjs/swagger");
const PHOTO_MAX_BYTES = env_1.env.MEDIA_MAX_UPLOAD_BYTES;
let MedicineController = class MedicineController {
    medicineService;
    constructor(medicineService) {
        this.medicineService = medicineService;
    }
    create(farmId, userId, dto) {
        return this.medicineService.create(farmId, userId, dto);
    }
    bulkDelete(farmId, userId, dto) {
        return this.medicineService.removeMany(farmId, dto.ids, userId);
    }
    findAll(farmId, query) {
        return this.medicineService.findAll(farmId, query);
    }
    findByBatchCode(farmId, query) {
        return this.medicineService.findByBatchCode(farmId, query.code);
    }
    findOne(farmId, id) {
        return this.medicineService.findOne(farmId, id);
    }
    update(farmId, userId, id, dto) {
        return this.medicineService.update(farmId, id, dto, userId);
    }
    createBatch(farmId, userId, id, dto) {
        return this.medicineService.createBatch(farmId, userId, id, dto);
    }
    adjustStock(farmId, userId, id, dto) {
        return this.medicineService.adjustStockManual(farmId, userId, id, dto);
    }
    getPhoto(farmId, id) {
        return this.medicineService.getPhoto(farmId, id);
    }
    setPhoto(farmId, userId, id, file) {
        return this.medicineService.setPhoto(farmId, userId, id, file);
    }
    removePhoto(farmId, userId, id) {
        return this.medicineService.removePhoto(farmId, userId, id);
    }
    archive(farmId, userId, id) {
        return this.medicineService.archive(farmId, id, userId);
    }
    restore(farmId, userId, id) {
        return this.medicineService.restore(farmId, id, userId);
    }
    remove(farmId, userId, id) {
        return this.medicineService.remove(farmId, id, userId);
    }
};
exports.MedicineController = MedicineController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_medicine_dto_1.CreateMedicineDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, bulk_delete_medicine_dto_1.BulkDeleteMedicineDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_medicine_query_dto_1.ListMedicineQueryDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('by-batch-code'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, medicine_by_batch_code_query_dto_1.MedicineByBatchCodeQueryDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "findByBatchCode", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_medicine_dto_1.UpdateMedicineDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/batches'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, create_medicine_batch_dto_1.CreateMedicineBatchDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Post)(':id/adjust-stock'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, adjust_stock_dto_1.AdjustStockDto]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "adjustStock", null);
__decorate([
    (0, common_1.Get)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "getPhoto", null);
__decorate([
    (0, common_1.Post)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    (0, decorators_1.ThrottleUpload)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: PHOTO_MAX_BYTES } })),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "setPhoto", null);
__decorate([
    (0, common_1.Delete)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "removePhoto", null);
__decorate([
    (0, common_1.Patch)(':id/archive'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(':id/restore'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "restore", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MedicineController.prototype, "remove", null);
exports.MedicineController = MedicineController = __decorate([
    (0, swagger_1.ApiTags)('Inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('inventory/medicines'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [medicine_service_1.MedicineService])
], MedicineController);
//# sourceMappingURL=medicine.controller.js.map