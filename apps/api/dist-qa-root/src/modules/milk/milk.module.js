"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const activity_module_1 = require("../activity/activity.module");
const inventory_module_1 = require("../inventory/inventory.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const subscription_module_1 = require("../subscription/subscription.module");
const health_module_1 = require("../health/health.module");
const cattle_module_1 = require("../cattle/cattle.module");
const milk_availability_service_1 = require("./application/services/milk-availability.service");
const milk_export_service_1 = require("./application/services/milk-export.service");
const milk_import_service_1 = require("./application/services/milk-import.service");
const milk_quality_service_1 = require("./application/services/milk-quality.service");
const milk_service_1 = require("./application/services/milk.service");
const milk_controller_1 = require("./presentation/controllers/milk.controller");
let MilkModule = class MilkModule {
};
exports.MilkModule = MilkModule;
exports.MilkModule = MilkModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            activity_module_1.ActivityModule,
            inventory_module_1.InventoryModule,
            farm_settings_module_1.FarmSettingsModule,
            subscription_module_1.SubscriptionModule,
            health_module_1.HealthModule,
            cattle_module_1.CattleModule,
        ],
        controllers: [milk_controller_1.MilkController],
        providers: [
            milk_service_1.MilkService,
            milk_import_service_1.MilkImportService,
            milk_export_service_1.MilkExportService,
            milk_quality_service_1.MilkQualityService,
            milk_availability_service_1.MilkAvailabilityService,
        ],
        exports: [milk_service_1.MilkService, milk_quality_service_1.MilkQualityService, milk_availability_service_1.MilkAvailabilityService],
    })
], MilkModule);
//# sourceMappingURL=milk.module.js.map