"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const email_module_1 = require("../email/email.module");
const subscription_access_service_1 = require("./application/services/subscription-access.service");
const plan_catalogue_service_1 = require("./application/services/plan-catalogue.service");
const subscription_lifecycle_service_1 = require("./application/services/subscription-lifecycle.service");
const subscription_feature_guard_1 = require("./presentation/guards/subscription-feature.guard");
const subscription_guard_1 = require("./presentation/guards/subscription.guard");
const plan_controller_1 = require("./presentation/controllers/plan.controller");
const subscription_controller_1 = require("./presentation/controllers/subscription.controller");
let SubscriptionModule = class SubscriptionModule {
};
exports.SubscriptionModule = SubscriptionModule;
exports.SubscriptionModule = SubscriptionModule = __decorate([
    (0, common_1.Module)({
        imports: [logger_module_1.LoggerModule, auth_module_1.AuthModule, tenant_access_module_1.TenantAccessModule, email_module_1.EmailModule],
        controllers: [plan_controller_1.PlanController, subscription_controller_1.SubscriptionController],
        providers: [
            subscription_access_service_1.SubscriptionAccessService,
            plan_catalogue_service_1.PlanCatalogueService,
            subscription_lifecycle_service_1.SubscriptionLifecycleService,
            subscription_feature_guard_1.SubscriptionFeatureGuard,
            subscription_guard_1.SubscriptionGuard,
        ],
        exports: [
            subscription_access_service_1.SubscriptionAccessService,
            plan_catalogue_service_1.PlanCatalogueService,
            subscription_lifecycle_service_1.SubscriptionLifecycleService,
            subscription_feature_guard_1.SubscriptionFeatureGuard,
            subscription_guard_1.SubscriptionGuard,
        ],
    })
], SubscriptionModule);
//# sourceMappingURL=subscription.module.js.map