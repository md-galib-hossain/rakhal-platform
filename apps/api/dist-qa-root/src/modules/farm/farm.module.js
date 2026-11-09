"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const billing_module_1 = require("../billing/billing.module");
const compliance_module_1 = require("../compliance/compliance.module");
const support_module_1 = require("../support/support.module");
const subscription_module_1 = require("../subscription/subscription.module");
const email_module_1 = require("../email/email.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const farm_service_1 = require("./application/services/farm.service");
const farm_controller_1 = require("./presentation/controllers/farm.controller");
let FarmModule = class FarmModule {
};
exports.FarmModule = FarmModule;
exports.FarmModule = FarmModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            support_module_1.SupportModule,
            subscription_module_1.SubscriptionModule,
            billing_module_1.BillingModule,
            compliance_module_1.ComplianceModule,
            email_module_1.EmailModule,
            tenant_access_module_1.TenantAccessModule,
        ],
        controllers: [farm_controller_1.FarmController],
        providers: [farm_service_1.FarmService],
        exports: [farm_service_1.FarmService],
    })
], FarmModule);
//# sourceMappingURL=farm.module.js.map