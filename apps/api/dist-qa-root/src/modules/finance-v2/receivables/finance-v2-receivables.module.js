"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceV2ReceivablesModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("src/modules/auth/auth.module");
const tenant_access_module_1 = require("src/modules/tenant-access/tenant-access.module");
const permission_module_1 = require("src/modules/permission/permission.module");
const subscription_module_1 = require("src/modules/subscription/subscription.module");
const receivable_service_1 = require("./application/receivable.service");
const receivable_controller_1 = require("./presentation/controllers/receivable.controller");
let FinanceV2ReceivablesModule = class FinanceV2ReceivablesModule {
};
exports.FinanceV2ReceivablesModule = FinanceV2ReceivablesModule;
exports.FinanceV2ReceivablesModule = FinanceV2ReceivablesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            subscription_module_1.SubscriptionModule,
        ],
        controllers: [receivable_controller_1.ReceivableController],
        providers: [receivable_service_1.ReceivableService],
        exports: [receivable_service_1.ReceivableService],
    })
], FinanceV2ReceivablesModule);
//# sourceMappingURL=finance-v2-receivables.module.js.map