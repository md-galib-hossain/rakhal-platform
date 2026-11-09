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
exports.LactationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const lactation_stats_service_1 = require("../application/services/lactation-stats.service");
const lactation_economics_service_1 = require("../application/services/lactation-economics.service");
const lactation_curve_query_dto_1 = require("./dto/lactation-curve-query.dto");
const update_planned_dry_off_dto_1 = require("./dto/update-planned-dry-off.dto");
const compare_lactation_query_dto_1 = require("./dto/compare-lactation-query.dto");
const compare_lactation_groups_query_dto_1 = require("./dto/compare-lactation-groups-query.dto");
let LactationController = class LactationController {
    lactationStatsService;
    lactationEconomicsService;
    constructor(lactationStatsService, lactationEconomicsService) {
        this.lactationStatsService = lactationStatsService;
        this.lactationEconomicsService = lactationEconomicsService;
    }
    compareLactations(farmId, query) {
        return this.lactationStatsService.compareLactations(farmId, query.cattleId, query.byLactationNumber ?? true);
    }
    compareGroups(farmId, query) {
        return this.lactationStatsService.compareGroups(farmId, query.groupBy);
    }
    getStats(farmId, id) {
        return this.lactationStatsService.getStats(farmId, id);
    }
    getCurve(farmId, id, query) {
        return this.lactationStatsService.getCurve(farmId, id, query.compareLactationId);
    }
    getEconomics(farmId, id) {
        return this.lactationEconomicsService.getEconomics(farmId, id);
    }
    updatePlannedDryOff(farmId, id, dto) {
        return this.lactationStatsService.updatePlannedDryOff(farmId, id, dto.plannedDryOffAt ? new Date(dto.plannedDryOffAt) : null);
    }
};
exports.LactationController = LactationController;
__decorate([
    (0, common_1.Get)('compare'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, compare_lactation_query_dto_1.CompareLactationQueryDto]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "compareLactations", null);
__decorate([
    (0, common_1.Get)('compare/groups'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, compare_lactation_groups_query_dto_1.CompareLactationGroupsQueryDto]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "compareGroups", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id/curve'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, lactation_curve_query_dto_1.LactationCurveQueryDto]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "getCurve", null);
__decorate([
    (0, common_1.Get)(':id/economics'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "getEconomics", null);
__decorate([
    (0, common_1.Patch)(':id/planned-dry-off'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_planned_dry_off_dto_1.UpdatePlannedDryOffDto]),
    __metadata("design:returntype", void 0)
], LactationController.prototype, "updatePlannedDryOff", null);
exports.LactationController = LactationController = __decorate([
    (0, swagger_1.ApiTags)('Reproduction'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reproduction/lactations'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [lactation_stats_service_1.LactationStatsService,
        lactation_economics_service_1.LactationEconomicsService])
], LactationController);
//# sourceMappingURL=lactation.controller.js.map