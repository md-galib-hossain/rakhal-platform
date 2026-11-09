"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const milk_module_1 = require("../milk/milk.module");
const health_module_1 = require("../health/health.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const feed_module_1 = require("../feed/feed.module");
const finance_v2_accounts_module_1 = require("../finance-v2/accounts/finance-v2-accounts.module");
const dashboard_service_1 = require("./application/services/dashboard.service");
const dashboard_controller_1 = require("./presentation/controllers/dashboard.controller");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            milk_module_1.MilkModule,
            health_module_1.HealthModule,
            farm_settings_module_1.FarmSettingsModule,
            feed_module_1.FeedModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
        ],
        controllers: [dashboard_controller_1.DashboardController],
        providers: [dashboard_service_1.DashboardService],
        exports: [dashboard_service_1.DashboardService],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map