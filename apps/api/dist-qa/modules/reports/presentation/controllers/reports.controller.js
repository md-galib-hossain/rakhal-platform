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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const subscription_feature_guard_1 = require("src/modules/subscription/presentation/guards/subscription-feature.guard");
const require_feature_decorator_1 = require("src/modules/subscription/presentation/decorators/require-feature.decorator");
const reports_api_service_1 = require("../../application/api/reports-api.service");
const report_caller_decorator_1 = require("../decorators/report-caller.decorator");
const reports_dto_1 = require("../dto/reports.dto");
let ReportsController = class ReportsController {
    reports;
    constructor(reports) {
        this.reports = reports;
    }
    templates(caller) {
        return this.reports.templates(caller);
    }
    preview(caller, dto) {
        return this.reports.preview(caller, dto);
    }
    async create(caller, dto, idempotencyKey, res) {
        const result = await this.reports.create(caller, dto, idempotencyKey);
        if (result.duplicate || result.replayed)
            res.status(200);
        return result.duplicate
            ? { duplicate: true, existing: result.existing }
            : { duplicate: false, replayed: result.replayed, report: result.report };
    }
    list(caller, query) {
        return this.reports.list(caller, query);
    }
    getOne(caller, { id }) {
        return this.reports.getOne(caller, id);
    }
    async download(caller, { id }, res) {
        const file = await this.reports.download(caller, id);
        res.set({
            'Content-Type': file.contentType,
            'Content-Disposition': `attachment; filename="${file.fileName}"`,
            'Content-Length': String(file.body.length),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        });
        res.send(file.body);
    }
    retry(caller, { id }) {
        return this.reports.retry(caller, id);
    }
    remove(caller, { id }) {
        return this.reports.remove(caller, id);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permission_decorator_1.RequirePermission)('reports.read'),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "templates", null);
__decorate([
    (0, common_1.Post)('preview'),
    (0, require_permission_decorator_1.RequirePermission)('reports.read'),
    (0, require_feature_decorator_1.RequireFeature)('reports.generate'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 3 } }),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.PreviewReportDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('reports.create'),
    (0, require_feature_decorator_1.RequireFeature)('reports.generate'),
    (0, decorators_1.ThrottleExpensive)(),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.CreateReportDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('reports.read'),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.ListReportsQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('reports.read'),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.ReportIdParamDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, require_permission_decorator_1.RequirePermission)('reports.read'),
    (0, decorators_1.ThrottleExpensive)(),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.ReportIdParamDto, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "download", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    (0, require_permission_decorator_1.RequirePermission)('reports.create'),
    (0, require_feature_decorator_1.RequireFeature)('reports.generate'),
    (0, decorators_1.ThrottleExpensive)(),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.ReportIdParamDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "retry", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('reports.delete'),
    __param(0, (0, report_caller_decorator_1.Caller)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reports_dto_1.ReportIdParamDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "remove", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('Reports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard, subscription_feature_guard_1.SubscriptionFeatureGuard),
    __metadata("design:paramtypes", [reports_api_service_1.ReportsApiService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map