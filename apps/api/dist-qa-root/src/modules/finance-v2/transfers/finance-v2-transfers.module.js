"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceV2TransfersModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const finance_v2_accounts_module_1 = require("src/modules/finance-v2/accounts/finance-v2-accounts.module");
const activity_module_1 = require("src/modules/activity/activity.module");
const transfer_service_1 = require("./application/transfer.service");
const transfer_controller_1 = require("./presentation/controllers/transfer.controller");
let FinanceV2TransfersModule = class FinanceV2TransfersModule {
};
exports.FinanceV2TransfersModule = FinanceV2TransfersModule;
exports.FinanceV2TransfersModule = FinanceV2TransfersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
            activity_module_1.ActivityModule,
        ],
        controllers: [transfer_controller_1.TransferController],
        providers: [transfer_service_1.TransferService],
        exports: [transfer_service_1.TransferService],
    })
], FinanceV2TransfersModule);
//# sourceMappingURL=finance-v2-transfers.module.js.map