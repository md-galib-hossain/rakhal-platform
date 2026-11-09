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
exports.MilkController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const milk_availability_service_1 = require("../../application/services/milk-availability.service");
const milk_export_service_1 = require("../../application/services/milk-export.service");
const milk_import_service_1 = require("../../application/services/milk-import.service");
const milk_quality_service_1 = require("../../application/services/milk-quality.service");
const milk_service_1 = require("../../application/services/milk.service");
const create_milk_quality_test_dto_1 = require("../dto/create-milk-quality-test.dto");
const export_milk_log_dto_1 = require("../dto/export-milk-log.dto");
const import_milk_dto_1 = require("../dto/import-milk.dto");
const milk_log_calendar_query_dto_1 = require("../dto/milk-log-calendar-query.dto");
const list_milk_quality_test_query_dto_1 = require("../dto/list-milk-quality-test-query.dto");
const milk_query_dto_1 = require("../dto/milk-query.dto");
const review_anomaly_dto_1 = require("../dto/review-anomaly.dto");
const save_milk_log_dto_1 = require("../dto/save-milk-log.dto");
const submit_milk_dto_1 = require("../dto/submit-milk.dto");
const swagger_1 = require("@nestjs/swagger");
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
let MilkController = class MilkController {
    milkService;
    importService;
    exportService;
    milkQualityService;
    milkAvailabilityService;
    constructor(milkService, importService, exportService, milkQualityService, milkAvailabilityService) {
        this.milkService = milkService;
        this.importService = importService;
        this.exportService = exportService;
        this.milkQualityService = milkQualityService;
        this.milkAvailabilityService = milkAvailabilityService;
    }
    availability(farmId, query) {
        return this.milkAvailabilityService.getAvailability(farmId, query.tankId);
    }
    overview(farmId, query) {
        return this.milkService.overview(farmId, query.date, query.range);
    }
    logTable(farmId, query) {
        return this.milkService.logTable(farmId, query);
    }
    logCalendar(farmId, query) {
        return this.milkService.logCalendar(farmId, query.month);
    }
    saveLog(farmId, userId, dto) {
        return this.milkService.saveLog(farmId, userId, dto);
    }
    submit(farmId, userId, dto) {
        return this.milkService.submit(farmId, userId, dto);
    }
    eligibility(farmId, id) {
        return this.milkService.getMilkEligibility(farmId, id);
    }
    anomalies(farmId, query) {
        return this.milkService.anomalies(farmId, query);
    }
    reviewAnomaly(farmId, id, dto) {
        return this.milkService.reviewAnomaly(farmId, id, dto);
    }
    importPreview(farmId, file) {
        return this.importService.preview(farmId, file);
    }
    importConfirm(farmId, userId, dto) {
        return this.importService.confirm(farmId, userId, dto);
    }
    async exportLog(farmId, dto, res) {
        const { buffer, filename } = await this.exportService.exportLog(farmId, dto);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        });
        res.send(buffer);
    }
    createQualityTest(farmId, userId, dto) {
        return this.milkQualityService.create(farmId, userId, dto);
    }
    latestQualityTest(farmId, query) {
        return this.milkQualityService.latestForCattle(farmId, query.cattleId);
    }
    listQualityTests(farmId, query) {
        return this.milkQualityService.list(farmId, query);
    }
};
exports.MilkController = MilkController;
__decorate([
    (0, common_1.Get)('availability'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_query_dto_1.MilkAvailabilityQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "availability", null);
__decorate([
    (0, common_1.Get)('overview'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_query_dto_1.MilkOverviewQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('log'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_query_dto_1.MilkLogQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "logTable", null);
__decorate([
    (0, common_1.Get)('log/calendar'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_log_calendar_query_dto_1.MilkLogCalendarQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "logCalendar", null);
__decorate([
    (0, common_1.Post)('log'),
    (0, require_permission_decorator_1.RequirePermission)('milk.log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, save_milk_log_dto_1.SaveMilkLogDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "saveLog", null);
__decorate([
    (0, common_1.Post)('submit'),
    (0, require_permission_decorator_1.RequirePermission)('milk.log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, submit_milk_dto_1.SubmitMilkDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)('cattle/:id/eligibility'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "eligibility", null);
__decorate([
    (0, common_1.Get)('anomalies'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, milk_query_dto_1.MilkAnomalyQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "anomalies", null);
__decorate([
    (0, common_1.Post)('anomalies/:id/review'),
    (0, require_permission_decorator_1.RequirePermission)('milk.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, review_anomaly_dto_1.ReviewAnomalyDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "reviewAnomaly", null);
__decorate([
    (0, common_1.Post)('import/preview'),
    (0, require_permission_decorator_1.RequirePermission)('milk.log'),
    (0, decorators_1.ThrottleUpload)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: IMPORT_MAX_BYTES } })),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "importPreview", null);
__decorate([
    (0, common_1.Post)('import/confirm'),
    (0, require_permission_decorator_1.RequirePermission)('milk.log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, import_milk_dto_1.ImportMilkConfirmDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "importConfirm", null);
__decorate([
    (0, common_1.Post)('export'),
    (0, require_permission_decorator_1.RequirePermission)('milk.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, export_milk_log_dto_1.ExportMilkLogDto, Object]),
    __metadata("design:returntype", Promise)
], MilkController.prototype, "exportLog", null);
__decorate([
    (0, common_1.Post)('quality-tests'),
    (0, require_permission_decorator_1.RequirePermission)('milk.quality.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_milk_quality_test_dto_1.CreateMilkQualityTestDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "createQualityTest", null);
__decorate([
    (0, common_1.Get)('quality-tests/latest'),
    (0, require_permission_decorator_1.RequirePermission)('milk.quality.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_milk_quality_test_query_dto_1.LatestMilkQualityTestQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "latestQualityTest", null);
__decorate([
    (0, common_1.Get)('quality-tests'),
    (0, require_permission_decorator_1.RequirePermission)('milk.quality.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_milk_quality_test_query_dto_1.ListMilkQualityTestQueryDto]),
    __metadata("design:returntype", void 0)
], MilkController.prototype, "listQualityTests", null);
exports.MilkController = MilkController = __decorate([
    (0, swagger_1.ApiTags)('Milk'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('milk'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [milk_service_1.MilkService,
        milk_import_service_1.MilkImportService,
        milk_export_service_1.MilkExportService,
        milk_quality_service_1.MilkQualityService,
        milk_availability_service_1.MilkAvailabilityService])
], MilkController);
//# sourceMappingURL=milk.controller.js.map