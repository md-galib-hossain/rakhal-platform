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
exports.BuyerController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const buyer_service_1 = require("../../application/services/buyer.service");
const create_buyer_dto_1 = require("../dto/create-buyer.dto");
const update_buyer_dto_1 = require("../dto/update-buyer.dto");
const list_buyer_query_dto_1 = require("../dto/list-buyer-query.dto");
const dispatch_query_dto_1 = require("../dto/dispatch-query.dto");
const record_receipt_dto_1 = require("../dto/record-receipt.dto");
const swagger_1 = require("@nestjs/swagger");
let BuyerController = class BuyerController {
    buyerService;
    constructor(buyerService) {
        this.buyerService = buyerService;
    }
    list(farmId, query) {
        return this.buyerService.listBuyers(farmId, query);
    }
    create(farmId, userId, dto) {
        return this.buyerService.createBuyer(farmId, userId, dto);
    }
    summary(farmId) {
        return this.buyerService.getBuyersSummary(farmId);
    }
    groups(farmId) {
        return this.buyerService.getBuyerGroups(farmId);
    }
    listDispatches(farmId, query) {
        return this.buyerService.listDispatches(farmId, query);
    }
    dispatchesSummary(farmId) {
        return this.buyerService.getDispatchesSummary(farmId);
    }
    recordReceipt(farmId, userId, id, dto) {
        return this.buyerService.recordReceipt(farmId, userId, id, dto);
    }
    cancelDispatch(farmId, userId, id) {
        return this.buyerService.cancelDispatch(farmId, userId, id);
    }
    statement(farmId, id, query) {
        return this.buyerService.statement(farmId, id, query);
    }
    overview(farmId, id) {
        return this.buyerService.getBuyerOverview(farmId, id);
    }
    getOne(farmId, id) {
        return this.buyerService.getBuyer(farmId, id);
    }
    update(farmId, userId, id, dto) {
        return this.buyerService.updateBuyer(farmId, userId, id, dto);
    }
    remove(farmId, userId, id) {
        return this.buyerService.deactivateBuyer(farmId, userId, id);
    }
};
exports.BuyerController = BuyerController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_buyer_query_dto_1.ListBuyerQueryDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_buyer_dto_1.CreateBuyerDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('groups'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "groups", null);
__decorate([
    (0, common_1.Get)('dispatches'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dispatch_query_dto_1.DispatchQueryDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "listDispatches", null);
__decorate([
    (0, common_1.Get)('dispatches/summary'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "dispatchesSummary", null);
__decorate([
    (0, common_1.Patch)('dispatches/:id/receipt'),
    (0, require_permission_decorator_1.RequirePermission)('finance.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, record_receipt_dto_1.RecordReceiptDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "recordReceipt", null);
__decorate([
    (0, common_1.Post)('dispatches/:id/cancel'),
    (0, require_permission_decorator_1.RequirePermission)('finance.reverse'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "cancelDispatch", null);
__decorate([
    (0, common_1.Get)(':id/statement'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dispatch_query_dto_1.StatementQueryDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "statement", null);
__decorate([
    (0, common_1.Get)(':id/overview'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('finance.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_buyer_dto_1.UpdateBuyerDto]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('finance.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BuyerController.prototype, "remove", null);
exports.BuyerController = BuyerController = __decorate([
    (0, swagger_1.ApiTags)('Milk Buyers'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('buyers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [buyer_service_1.BuyerService])
], BuyerController);
//# sourceMappingURL=buyer.controller.js.map