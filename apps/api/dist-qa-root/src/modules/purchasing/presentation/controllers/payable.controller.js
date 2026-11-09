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
exports.PayableController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const payable_service_1 = require("../../application/payable.service");
const pay_supplier_use_case_1 = require("../../application/use-cases/pay-supplier/pay-supplier.use-case");
const list_payables_query_dto_1 = require("../dto/list-payables-query.dto");
const pay_supplier_dto_1 = require("../dto/pay-supplier.dto");
let PayableController = class PayableController {
    payables;
    paySupplier;
    constructor(payables, paySupplier) {
        this.payables = payables;
        this.paySupplier = paySupplier;
    }
    list(farmId, query) {
        return this.payables.listPayables(farmId, query);
    }
    findOne(farmId, id) {
        return this.payables.findOne(farmId, id);
    }
    pay(farmId, userId, id, dto) {
        return this.paySupplier.execute(farmId, userId, {
            ...dto,
            payableId: id,
        });
    }
};
exports.PayableController = PayableController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_payables_query_dto_1.ListPayablesQueryDto]),
    __metadata("design:returntype", void 0)
], PayableController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PayableController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/payments'),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, pay_supplier_dto_1.PaySupplierDto]),
    __metadata("design:returntype", void 0)
], PayableController.prototype, "pay", null);
exports.PayableController = PayableController = __decorate([
    (0, swagger_1.ApiTags)('Purchasing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchasing/payables'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [payable_service_1.PayableService,
        pay_supplier_use_case_1.PaySupplierUseCase])
], PayableController);
//# sourceMappingURL=payable.controller.js.map