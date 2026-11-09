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
exports.CalfController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const calf_service_1 = require("../../application/services/calf.service");
const list_calf_query_dto_1 = require("../dto/list-calf-query.dto");
const record_colostrum_dto_1 = require("../dto/record-colostrum.dto");
const record_milk_feeding_dto_1 = require("../dto/record-milk-feeding.dto");
const record_starter_feed_dto_1 = require("../dto/record-starter-feed.dto");
const record_weight_dto_1 = require("../dto/record-weight.dto");
const wean_calf_dto_1 = require("../dto/wean-calf.dto");
const swagger_1 = require("@nestjs/swagger");
let CalfController = class CalfController {
    calfService;
    constructor(calfService) {
        this.calfService = calfService;
    }
    list(farmId, query) {
        return this.calfService.list(farmId, query);
    }
    profile(farmId, id) {
        return this.calfService.profile(farmId, id);
    }
    colostrum(farmId, id, dto) {
        return this.calfService.recordColostrum(farmId, id, dto);
    }
    milkFeeding(farmId, id, dto) {
        return this.calfService.recordMilkFeeding(farmId, id, dto);
    }
    weight(farmId, userId, id, dto) {
        return this.calfService.recordWeight(farmId, userId, id, dto);
    }
    starterFeed(farmId, id, dto) {
        return this.calfService.recordStarterFeed(farmId, id, dto);
    }
    wean(farmId, id, dto) {
        return this.calfService.wean(farmId, id, dto);
    }
};
exports.CalfController = CalfController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('calf.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_calf_query_dto_1.ListCalfQueryDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('calf.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "profile", null);
__decorate([
    (0, common_1.Post)(':id/colostrum'),
    (0, require_permission_decorator_1.RequirePermission)('calf.log-feeding'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_colostrum_dto_1.RecordColostrumDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "colostrum", null);
__decorate([
    (0, common_1.Post)(':id/milk-feeding'),
    (0, require_permission_decorator_1.RequirePermission)('calf.log-feeding'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_milk_feeding_dto_1.RecordMilkFeedingDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "milkFeeding", null);
__decorate([
    (0, common_1.Post)(':id/weight'),
    (0, require_permission_decorator_1.RequirePermission)('calf.log-feeding'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, record_weight_dto_1.RecordWeightDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "weight", null);
__decorate([
    (0, common_1.Post)(':id/starter-feed'),
    (0, require_permission_decorator_1.RequirePermission)('calf.log-feeding'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_starter_feed_dto_1.RecordStarterFeedDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "starterFeed", null);
__decorate([
    (0, common_1.Post)(':id/wean'),
    (0, require_permission_decorator_1.RequirePermission)('calf.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, wean_calf_dto_1.WeanCalfDto]),
    __metadata("design:returntype", void 0)
], CalfController.prototype, "wean", null);
exports.CalfController = CalfController = __decorate([
    (0, swagger_1.ApiTags)('Calf'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('calves'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [calf_service_1.CalfService])
], CalfController);
//# sourceMappingURL=calf.controller.js.map