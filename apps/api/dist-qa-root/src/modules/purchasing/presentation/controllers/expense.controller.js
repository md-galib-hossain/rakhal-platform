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
exports.ExpenseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const expense_service_1 = require("../../application/expense.service");
const void_document_use_case_1 = require("../../application/use-cases/void-document/void-document.use-case");
const record_expense_dto_1 = require("../dto/record-expense.dto");
const list_expenses_query_dto_1 = require("../dto/list-expenses-query.dto");
let ExpenseController = class ExpenseController {
    expenses;
    voidDocument;
    constructor(expenses, voidDocument) {
        this.expenses = expenses;
        this.voidDocument = voidDocument;
    }
    create(farmId, userId, dto) {
        return this.expenses.recordExpense(farmId, userId, dto);
    }
    findAll(farmId, query) {
        return this.expenses.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.expenses.findOne(farmId, id);
    }
    void(farmId, userId, id) {
        return this.voidDocument.voidExpense(farmId, userId, id);
    }
};
exports.ExpenseController = ExpenseController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, record_expense_dto_1.RecordExpenseDto]),
    __metadata("design:returntype", void 0)
], ExpenseController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_expenses_query_dto_1.ListExpensesQueryDto]),
    __metadata("design:returntype", void 0)
], ExpenseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('purchasing.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ExpenseController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    (0, require_permission_decorator_1.RequirePermission)('finance.reverse'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ExpenseController.prototype, "void", null);
exports.ExpenseController = ExpenseController = __decorate([
    (0, swagger_1.ApiTags)('Purchasing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchasing/expenses'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [expense_service_1.ExpenseService,
        void_document_use_case_1.VoidDocumentUseCase])
], ExpenseController);
//# sourceMappingURL=expense.controller.js.map