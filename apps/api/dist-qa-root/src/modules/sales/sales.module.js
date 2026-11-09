"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const inventory_module_1 = require("src/modules/inventory/inventory.module");
const milk_module_1 = require("src/modules/milk/milk.module");
const cattle_module_1 = require("src/modules/cattle/cattle.module");
const finance_v2_receivables_module_1 = require("src/modules/finance-v2/receivables/finance-v2-receivables.module");
const finance_v2_payments_module_1 = require("src/modules/finance-v2/payments/finance-v2-payments.module");
const activity_module_1 = require("src/modules/activity/activity.module");
const sale_service_1 = require("./application/sale.service");
const sell_milk_use_case_1 = require("./application/use-cases/sell-milk/sell-milk.use-case");
const sell_inventory_use_case_1 = require("./application/use-cases/sell-inventory/sell-inventory.use-case");
const void_sale_use_case_1 = require("./application/use-cases/void-sale/void-sale.use-case");
const sale_number_allocator_1 = require("./infrastructure/sale-number.allocator");
const sale_controller_1 = require("./presentation/controllers/sale.controller");
const inventory_sale_controller_1 = require("./presentation/controllers/inventory-sale.controller");
let SalesModule = class SalesModule {
};
exports.SalesModule = SalesModule;
exports.SalesModule = SalesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
            inventory_module_1.InventoryModule,
            milk_module_1.MilkModule,
            cattle_module_1.CattleModule,
            finance_v2_receivables_module_1.FinanceV2ReceivablesModule,
            finance_v2_payments_module_1.FinanceV2PaymentsModule,
            activity_module_1.ActivityModule,
        ],
        controllers: [sale_controller_1.SaleController, inventory_sale_controller_1.InventorySaleController],
        providers: [
            sale_service_1.SaleService,
            sale_number_allocator_1.SaleNumberAllocator,
            sell_milk_use_case_1.SellMilkUseCase,
            sell_inventory_use_case_1.SellInventoryUseCase,
            void_sale_use_case_1.VoidSaleUseCase,
        ],
        exports: [
            sale_service_1.SaleService,
            sell_milk_use_case_1.SellMilkUseCase,
            sell_inventory_use_case_1.SellInventoryUseCase,
            void_sale_use_case_1.VoidSaleUseCase,
        ],
    })
], SalesModule);
//# sourceMappingURL=sales.module.js.map