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
exports.SaleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const sale_service_1 = require("../../application/sale.service");
const void_sale_use_case_1 = require("../../application/use-cases/void-sale/void-sale.use-case");
const create_sale_dto_1 = require("../dto/create-sale.dto");
const list_sales_query_dto_1 = require("../dto/list-sales-query.dto");
let SaleController = class SaleController {
    sales;
    voidSale;
    constructor(sales, voidSale) {
        this.sales = sales;
        this.voidSale = voidSale;
    }
    create(farmId, userId, dto) {
        return this.sales.createSale(farmId, userId, dto);
    }
    findAll(farmId, query) {
        return this.sales.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.sales.findOne(farmId, id);
    }
    cancel(farmId, userId, id) {
        return this.voidSale.cancelSale(farmId, userId, id);
    }
    refund(farmId, userId, id) {
        return this.voidSale.refundSale(farmId, userId, id);
    }
};
exports.SaleController = SaleController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('sales.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_sale_dto_1.CreateSaleDto]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('sales.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_sales_query_dto_1.ListSalesQueryDto]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('sales.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permission_decorator_1.RequirePermission)('finance.reverse'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/refund'),
    (0, require_permission_decorator_1.RequirePermission)('finance.reverse'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "refund", null);
exports.SaleController = SaleController = __decorate([
    (0, swagger_1.ApiTags)('Sales'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('sales'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [sale_service_1.SaleService,
        void_sale_use_case_1.VoidSaleUseCase])
], SaleController);
//# sourceMappingURL=sale.controller.js.map