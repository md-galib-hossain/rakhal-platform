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
exports.ActivityController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const activity_log_service_1 = require("../../application/services/activity-log.service");
const aqr_service_1 = require("../../application/services/aqr.service");
const list_activity_query_dto_1 = require("../dto/list-activity-query.dto");
const swagger_1 = require("@nestjs/swagger");
let ActivityController = class ActivityController {
    activityLog;
    aqr;
    constructor(activityLog, aqr) {
        this.activityLog = activityLog;
        this.aqr = aqr;
    }
    list(farmId, query) {
        return this.activityLog.list(farmId, query);
    }
    herdAqr(farmId) {
        return this.aqr.herdAqr(farmId).then((avgAqr) => ({ herdAqr: avgAqr }));
    }
    verifyChain(farmId) {
        return this.activityLog.verifyChain(farmId);
    }
};
exports.ActivityController = ActivityController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('activity.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_activity_query_dto_1.ListActivityQueryDto]),
    __metadata("design:returntype", void 0)
], ActivityController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('herd-aqr'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ActivityController.prototype, "herdAqr", null);
__decorate([
    (0, common_1.Get)('verify-chain'),
    (0, require_permission_decorator_1.RequirePermission)('activity.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ActivityController.prototype, "verifyChain", null);
exports.ActivityController = ActivityController = __decorate([
    (0, swagger_1.ApiTags)('Activity Log'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('activity-log'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [activity_log_service_1.ActivityLogService,
        aqr_service_1.AqrService])
], ActivityController);
//# sourceMappingURL=activity.controller.js.map