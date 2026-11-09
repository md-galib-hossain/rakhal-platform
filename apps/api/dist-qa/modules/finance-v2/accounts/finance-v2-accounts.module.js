"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceV2AccountsModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const activity_module_1 = require("src/modules/activity/activity.module");
const financial_account_service_1 = require("./application/financial-account.service");
const balance_service_1 = require("./application/balance.service");
const financial_account_controller_1 = require("./presentation/controllers/financial-account.controller");
const balance_controller_1 = require("./presentation/controllers/balance.controller");
let FinanceV2AccountsModule = class FinanceV2AccountsModule {
};
exports.FinanceV2AccountsModule = FinanceV2AccountsModule;
exports.FinanceV2AccountsModule = FinanceV2AccountsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
            activity_module_1.ActivityModule,
        ],
        controllers: [financial_account_controller_1.FinancialAccountController, balance_controller_1.BalanceController],
        providers: [financial_account_service_1.FinancialAccountService, balance_service_1.BalanceService],
        exports: [financial_account_service_1.FinancialAccountService, balance_service_1.BalanceService],
    })
], FinanceV2AccountsModule);
//# sourceMappingURL=finance-v2-accounts.module.js.map