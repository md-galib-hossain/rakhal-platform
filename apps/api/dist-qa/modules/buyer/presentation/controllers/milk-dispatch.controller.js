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
exports.MilkDispatchController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const buyer_service_1 = require("../../application/services/buyer.service");
const record_dispatch_dto_1 = require("../dto/record-dispatch.dto");
const dispatch_query_dto_1 = require("../dto/dispatch-query.dto");
const swagger_1 = require("@nestjs/swagger");
let MilkDispatchController = class MilkDispatchController {
    buyerService;
    constructor(buyerService) {
        this.buyerService = buyerService;
    }
    record(farmId, userId, dto) {
        return this.buyerService.recordDispatch(farmId, userId, dto);
    }
    history(farmId, query) {
        return this.buyerService.listDispatches(farmId, query);
    }
};
exports.MilkDispatchController = MilkDispatchController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_dispatch_dto_1.RecordDispatchDto]),
    __metadata("design:returntype", void 0)
], MilkDispatchController.prototype, "record", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dispatch_query_dto_1.DispatchQueryDto]),
    __metadata("design:returntype", void 0)
], MilkDispatchController.prototype, "history", null);
exports.MilkDispatchController = MilkDispatchController = __decorate([
    (0, swagger_1.ApiTags)('Milk Dispatch'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('milk/dispatch'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [buyer_service_1.BuyerService])
], MilkDispatchController);
//# sourceMappingURL=milk-dispatch.controller.js.map