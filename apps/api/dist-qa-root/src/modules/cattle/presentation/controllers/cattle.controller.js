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
exports.CattleController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const env_1 = require("src/core/config/env");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const bcs_service_1 = require("../../application/services/bcs.service");
const cattle_detail_service_1 = require("../../application/services/cattle-detail.service");
const cattle_import_service_1 = require("../../application/services/cattle-import.service");
const cattle_service_1 = require("../../application/services/cattle.service");
const weight_service_1 = require("../../application/services/weight.service");
const ancestry_query_dto_1 = require("../dto/ancestry-query.dto");
const archive_cattle_dto_1 = require("../dto/archive-cattle.dto");
const bulk_cattle_dto_1 = require("../dto/bulk-cattle.dto");
const cattle_finance_query_dto_1 = require("../dto/cattle-finance-query.dto");
const create_cattle_dto_1 = require("../dto/create-cattle.dto");
const dispose_cattle_dto_1 = require("../dto/dispose-cattle.dto");
const import_cattle_dto_1 = require("../dto/import-cattle.dto");
const list_cattle_query_dto_1 = require("../dto/list-cattle-query.dto");
const upcoming_events_query_dto_1 = require("../dto/upcoming-events-query.dto");
const update_cattle_dto_1 = require("../dto/update-cattle.dto");
const weight_history_query_dto_1 = require("../dto/weight-history-query.dto");
const swagger_1 = require("@nestjs/swagger");
const CSV_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_BYTES = env_1.env.MEDIA_MAX_UPLOAD_BYTES;
let CattleController = class CattleController {
    cattleService;
    bcsService;
    weightService;
    detailService;
    importService;
    constructor(cattleService, bcsService, weightService, detailService, importService) {
        this.cattleService = cattleService;
        this.bcsService = bcsService;
        this.weightService = weightService;
        this.detailService = detailService;
        this.importService = importService;
    }
    create(farmId, userId, dto) {
        return this.cattleService.create(farmId, userId, dto);
    }
    findAll(farmId, query) {
        return this.cattleService.findAll(farmId, query);
    }
    highlights(farmId) {
        return this.cattleService.highlights(farmId);
    }
    upcomingEvents(farmId, id, query) {
        return this.cattleService.findUpcomingEvents(farmId, id, query);
    }
    bulk(farmId, dto, userId) {
        return this.cattleService.bulk(farmId, dto, userId);
    }
    async downloadImportTemplate(res) {
        const buffer = await this.importService.buildTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="cattle-import-template.xlsx"',
        });
        res.send(buffer);
    }
    importPreview(farmId, file, dto) {
        return this.importService.preview(farmId, file, dto.mapping);
    }
    importConfirm(farmId, userId, dto) {
        return this.importService.confirm(farmId, userId, dto);
    }
    profile(farmId, id) {
        return this.cattleService.profile(farmId, id);
    }
    ancestry(farmId, id, query) {
        return this.cattleService.ancestry(farmId, id, query);
    }
    children(farmId, id) {
        return this.cattleService.children(farmId, id);
    }
    siblings(farmId, id) {
        return this.cattleService.siblings(farmId, id);
    }
    bcsHistory(farmId, id) {
        return this.bcsService.history(farmId, id);
    }
    weightHistory(farmId, id) {
        return this.weightService.history(farmId, id);
    }
    weightPeriodHistory(farmId, id, query) {
        return this.weightService.periodHistory(farmId, id, query.period);
    }
    getPhoto(farmId, id) {
        return this.cattleService.getProfilePhoto(farmId, id);
    }
    setPhoto(farmId, userId, id, file) {
        return this.cattleService.setProfilePhoto(farmId, userId, id, file);
    }
    removePhoto(farmId, userId, id) {
        return this.cattleService.removeProfilePhoto(farmId, userId, id);
    }
    overview(farmId, id) {
        return this.detailService.overview(farmId, id);
    }
    pedigree(farmId, id) {
        return this.detailService.pedigree(farmId, id);
    }
    finance(farmId, id, query) {
        return this.detailService.cattleFinance(farmId, id, query.period);
    }
    findOne(farmId, id) {
        return this.cattleService.findOne(farmId, id);
    }
    update(farmId, id, dto, userId) {
        return this.cattleService.update(farmId, id, dto, userId);
    }
    archive(farmId, id, userId) {
        return this.cattleService.archive(farmId, id, userId);
    }
    restore(farmId, id) {
        return this.cattleService.restore(farmId, id);
    }
    dispose(farmId, userId, id, dto) {
        return this.cattleService.recordDisposition(farmId, userId, id, {
            type: dto.type,
            date: new Date(dto.date),
            reason: dto.reason,
            price: dto.price,
        });
    }
    remove(farmId, id, dto, userId) {
        return this.cattleService.remove(farmId, id, dto, userId);
    }
};
exports.CattleController = CattleController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_cattle_dto_1.CreateCattleDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_cattle_query_dto_1.ListCattleQueryDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('highlights'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "highlights", null);
__decorate([
    (0, common_1.Get)(':id/upcoming-events'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upcoming_events_query_dto_1.UpcomingEventsQueryDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "upcomingEvents", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bulk_cattle_dto_1.BulkCattleDto, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "bulk", null);
__decorate([
    (0, common_1.Get)('import/template'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CattleController.prototype, "downloadImportTemplate", null);
__decorate([
    (0, common_1.Post)('import/preview'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    (0, decorators_1.ThrottleUpload)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: CSV_MAX_BYTES } })),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, import_cattle_dto_1.ImportPreviewDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "importPreview", null);
__decorate([
    (0, common_1.Post)('import/confirm'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, import_cattle_dto_1.ImportConfirmDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "importConfirm", null);
__decorate([
    (0, common_1.Get)(':id/profile'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)(':id/ancestry'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, ancestry_query_dto_1.AncestryQueryDto]),
    __metadata("design:returntype", Promise)
], CattleController.prototype, "ancestry", null);
__decorate([
    (0, common_1.Get)(':id/children'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "children", null);
__decorate([
    (0, common_1.Get)(':id/siblings'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "siblings", null);
__decorate([
    (0, common_1.Get)(':id/bcs'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "bcsHistory", null);
__decorate([
    (0, common_1.Get)(':id/weight'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "weightHistory", null);
__decorate([
    (0, common_1.Get)(':id/weight/history'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, weight_history_query_dto_1.WeightHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "weightPeriodHistory", null);
__decorate([
    (0, common_1.Get)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "getPhoto", null);
__decorate([
    (0, common_1.Post)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    (0, decorators_1.ThrottleUpload)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: PHOTO_MAX_BYTES } })),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "setPhoto", null);
__decorate([
    (0, common_1.Delete)(':id/photo'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "removePhoto", null);
__decorate([
    (0, common_1.Get)(':id/overview'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)(':id/pedigree'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "pedigree", null);
__decorate([
    (0, common_1.Get)(':id/finance'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, cattle_finance_query_dto_1.CattleFinanceQueryDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "finance", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_cattle_dto_1.UpdateCattleDto, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/archive'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.archive'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(':id/restore'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "restore", null);
__decorate([
    (0, common_1.Post)(':id/dispose'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.dispose'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, dispose_cattle_dto_1.DisposeCattleDto]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "dispose", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.archive'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, archive_cattle_dto_1.ArchiveCattleDto, String]),
    __metadata("design:returntype", void 0)
], CattleController.prototype, "remove", null);
exports.CattleController = CattleController = __decorate([
    (0, swagger_1.ApiTags)('Cattle'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('cattle'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [cattle_service_1.CattleService,
        bcs_service_1.BcsService,
        weight_service_1.WeightService,
        cattle_detail_service_1.CattleDetailService,
        cattle_import_service_1.CattleImportService])
], CattleController);
//# sourceMappingURL=cattle.controller.js.map