"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellAnimalModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const sales_module_1 = require("src/modules/sales/sales.module");
const cattle_module_1 = require("src/modules/cattle/cattle.module");
const finance_v2_receivables_module_1 = require("src/modules/finance-v2/receivables/finance-v2-receivables.module");
const finance_v2_payments_module_1 = require("src/modules/finance-v2/payments/finance-v2-payments.module");
const activity_module_1 = require("src/modules/activity/activity.module");
const sell_animal_use_case_1 = require("./sell-animal.use-case");
const animal_sale_controller_1 = require("../../../presentation/controllers/animal-sale.controller");
let SellAnimalModule = class SellAnimalModule {
};
exports.SellAnimalModule = SellAnimalModule;
exports.SellAnimalModule = SellAnimalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            subscription_module_1.SubscriptionModule,
            sales_module_1.SalesModule,
            cattle_module_1.CattleModule,
            finance_v2_receivables_module_1.FinanceV2ReceivablesModule,
            finance_v2_payments_module_1.FinanceV2PaymentsModule,
            activity_module_1.ActivityModule,
        ],
        controllers: [animal_sale_controller_1.AnimalSaleController],
        providers: [sell_animal_use_case_1.SellAnimalUseCase],
        exports: [sell_animal_use_case_1.SellAnimalUseCase],
    })
], SellAnimalModule);
//# sourceMappingURL=sell-animal.module.js.map