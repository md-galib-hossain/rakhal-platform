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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const dashboard_service_1 = require("../../application/services/dashboard.service");
const dashboard_query_dto_1 = require("../dto/dashboard-query.dto");
const swagger_1 = require("@nestjs/swagger");
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    overviewBatch(farmId) {
        return this.dashboardService.overviewBatch(farmId);
    }
    priorities(farmId) {
        return this.dashboardService.priorities(farmId);
    }
    kpis(farmId) {
        return this.dashboardService.kpis(farmId);
    }
    productionSummary(farmId, query) {
        return this.dashboardService.productionSummary(farmId, query.period);
    }
    calvingForecast(farmId) {
        return this.dashboardService.calvingForecast(farmId);
    }
    herdStatus(farmId) {
        return this.dashboardService.herdStatus(farmId);
    }
    financialSnapshot(farmId) {
        return this.dashboardService.financialSnapshot(farmId);
    }
    livestockState(farmId, query) {
        return this.dashboardService.livestockState(farmId, query.period);
    }
    financialPerformance(farmId) {
        return this.dashboardService.financialPerformance(farmId);
    }
    productionVsFeedcost(farmId) {
        return this.dashboardService.productionVsFeedcost(farmId);
    }
    conceptionRate(farmId) {
        return this.dashboardService.conceptionRate(farmId);
    }
    feedCostSummary(farmId) {
        return this.dashboardService.feedCostSummary(farmId);
    }
    feedStockAlerts(farmId) {
        return this.dashboardService.feedStockAlerts(farmId);
    }
    upcomingTasks(farmId) {
        return this.dashboardService.upcomingTasks(farmId);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('overview-batch'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "overviewBatch", null);
__decorate([
    (0, common_1.Get)('priorities'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "priorities", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "kpis", null);
__decorate([
    (0, common_1.Get)('production-summary'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dashboard_query_dto_1.DashboardPeriodQueryDto]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "productionSummary", null);
__decorate([
    (0, common_1.Get)('calving-forecast'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "calvingForecast", null);
__decorate([
    (0, common_1.Get)('herd-status'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "herdStatus", null);
__decorate([
    (0, common_1.Get)('financial-snapshot'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "financialSnapshot", null);
__decorate([
    (0, common_1.Get)('livestock-state'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dashboard_query_dto_1.DashboardPeriodQueryDto]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "livestockState", null);
__decorate([
    (0, common_1.Get)('financial-performance'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "financialPerformance", null);
__decorate([
    (0, common_1.Get)('production-vs-feedcost'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "productionVsFeedcost", null);
__decorate([
    (0, common_1.Get)('conception-rate'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "conceptionRate", null);
__decorate([
    (0, common_1.Get)('feed-cost-summary'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "feedCostSummary", null);
__decorate([
    (0, common_1.Get)('feed-stock-alerts'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "feedStockAlerts", null);
__decorate([
    (0, common_1.Get)('upcoming-tasks'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "upcomingTasks", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('Dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map