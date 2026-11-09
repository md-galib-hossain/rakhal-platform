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
exports.IncomeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const income_service_1 = require("../../application/income.service");
const create_income_category_dto_1 = require("../dto/create-income-category.dto");
const record_other_income_dto_1 = require("../dto/record-other-income.dto");
let IncomeController = class IncomeController {
    income;
    constructor(income) {
        this.income = income;
    }
    listCategories(farmId) {
        return this.income.listCategories(farmId);
    }
    createCategory(farmId, dto) {
        return this.income.createCategory(farmId, dto);
    }
    record(farmId, userId, dto) {
        return this.income.recordOtherIncome(farmId, userId, dto);
    }
    findAll(farmId) {
        return this.income.findAll(farmId);
    }
    findOne(farmId, id) {
        return this.income.findOne(farmId, id);
    }
};
exports.IncomeController = IncomeController;
__decorate([
    (0, common_1.Get)('categories'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IncomeController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, require_permission_decorator_1.RequirePermission)('finance.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_income_category_dto_1.CreateIncomeCategoryDto]),
    __metadata("design:returntype", void 0)
], IncomeController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_other_income_dto_1.RecordOtherIncomeDto]),
    __metadata("design:returntype", void 0)
], IncomeController.prototype, "record", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IncomeController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('finance.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], IncomeController.prototype, "findOne", null);
exports.IncomeController = IncomeController = __decorate([
    (0, swagger_1.ApiTags)('Finance V2'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('finance/income'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [income_service_1.IncomeService])
], IncomeController);
//# sourceMappingURL=income.controller.js.map