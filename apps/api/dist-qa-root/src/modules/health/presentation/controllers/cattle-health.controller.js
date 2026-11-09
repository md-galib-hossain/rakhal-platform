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
exports.CattleHealthController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const health_service_1 = require("../../application/services/health.service");
const stop_protocol_dto_1 = require("../dto/stop-protocol.dto");
const swagger_1 = require("@nestjs/swagger");
let CattleHealthController = class CattleHealthController {
    healthService;
    constructor(healthService) {
        this.healthService = healthService;
    }
    summary(farmId, id) {
        return this.healthService.getCattleHealthSummary(farmId, id);
    }
    protocols(farmId, id) {
        return this.healthService.getCattleProtocols(farmId, id);
    }
    stopProtocol(farmId, id, dto) {
        return this.healthService.stopCattleProtocol(farmId, id, dto);
    }
    cancelProtocol(farmId, userId, id, dto) {
        return this.healthService.cancelAnimalProtocol(farmId, userId, id, dto);
    }
};
exports.CattleHealthController = CattleHealthController;
__decorate([
    (0, common_1.Get)(':id/health-summary'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleHealthController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)(':id/protocols'),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CattleHealthController.prototype, "protocols", null);
__decorate([
    (0, common_1.Post)(':id/protocols/stop'),
    (0, common_1.HttpCode)(200),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, stop_protocol_dto_1.StopCattleProtocolDto]),
    __metadata("design:returntype", void 0)
], CattleHealthController.prototype, "stopProtocol", null);
__decorate([
    (0, common_1.Post)(':id/protocols/cancel'),
    (0, common_1.HttpCode)(200),
    (0, require_permission_decorator_1.RequirePermission)('healthcare.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, stop_protocol_dto_1.StopCattleProtocolDto]),
    __metadata("design:returntype", void 0)
], CattleHealthController.prototype, "cancelProtocol", null);
exports.CattleHealthController = CattleHealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('cattle'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [health_service_1.HealthService])
], CattleHealthController);
//# sourceMappingURL=cattle-health.controller.js.map