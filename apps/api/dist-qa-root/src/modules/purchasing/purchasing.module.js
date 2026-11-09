"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchasingModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const finance_v2_accounts_module_1 = require("src/modules/finance-v2/accounts/finance-v2-accounts.module");
const finance_v2_payments_module_1 = require("src/modules/finance-v2/payments/finance-v2-payments.module");
const inventory_module_1 = require("src/modules/inventory/inventory.module");
const activity_module_1 = require("src/modules/activity/activity.module");
const purchase_service_1 = require("./application/purchase.service");
const expense_service_1 = require("./application/expense.service");
const payable_service_1 = require("./application/payable.service");
const supplier_read_service_1 = require("./application/supplier-read.service");
const pay_supplier_use_case_1 = require("./application/use-cases/pay-supplier/pay-supplier.use-case");
const void_document_use_case_1 = require("./application/use-cases/void-document/void-document.use-case");
const purchase_number_allocator_1 = require("./infrastructure/purchase-number.allocator");
const purchase_controller_1 = require("./presentation/controllers/purchase.controller");
const expense_controller_1 = require("./presentation/controllers/expense.controller");
const payable_controller_1 = require("./presentation/controllers/payable.controller");
const supplier_read_controller_1 = require("./presentation/controllers/supplier-read.controller");
let PurchasingModule = class PurchasingModule {
};
exports.PurchasingModule = PurchasingModule;
exports.PurchasingModule = PurchasingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
            inventory_module_1.InventoryModule,
            (0, common_1.forwardRef)(() => finance_v2_payments_module_1.FinanceV2PaymentsModule),
            activity_module_1.ActivityModule,
        ],
        controllers: [
            purchase_controller_1.PurchaseController,
            expense_controller_1.ExpenseController,
            payable_controller_1.PayableController,
            supplier_read_controller_1.SupplierReadController,
        ],
        providers: [
            purchase_service_1.PurchaseService,
            expense_service_1.ExpenseService,
            payable_service_1.PayableService,
            supplier_read_service_1.SupplierReadService,
            purchase_number_allocator_1.PurchaseNumberAllocator,
            pay_supplier_use_case_1.PaySupplierUseCase,
            void_document_use_case_1.VoidDocumentUseCase,
        ],
        exports: [
            purchase_service_1.PurchaseService,
            expense_service_1.ExpenseService,
            payable_service_1.PayableService,
            pay_supplier_use_case_1.PaySupplierUseCase,
            void_document_use_case_1.VoidDocumentUseCase,
        ],
    })
], PurchasingModule);
//# sourceMappingURL=purchasing.module.js.map