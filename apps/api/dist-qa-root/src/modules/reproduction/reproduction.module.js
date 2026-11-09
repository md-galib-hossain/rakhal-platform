"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproductionModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const activity_module_1 = require("../activity/activity.module");
const task_module_1 = require("../task/task.module");
const inventory_module_1 = require("../inventory/inventory.module");
const calf_module_1 = require("../calf/calf.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const subscription_module_1 = require("../subscription/subscription.module");
const purchasing_module_1 = require("../purchasing/purchasing.module");
const cattle_module_1 = require("../cattle/cattle.module");
const animal_events_module_1 = require("../animal-events/animal-events.module");
const reproduction_events_handler_1 = require("./application/events/reproduction-events.handler");
const reproduction_service_1 = require("./application/services/reproduction.service");
const reproduction_derivation_service_1 = require("./application/services/reproduction-derivation.service");
const reproduction_edit_service_1 = require("./application/services/reproduction-edit.service");
const reproduction_calving_edit_service_1 = require("./application/services/reproduction-calving-edit.service");
const repro_protocol_service_1 = require("./application/services/repro-protocol.service");
const lactation_stats_service_1 = require("./application/services/lactation-stats.service");
const lactation_economics_service_1 = require("./application/services/lactation-economics.service");
const cattle_reproduction_controller_1 = require("./presentation/controllers/cattle-reproduction.controller");
const reproduction_controller_1 = require("./presentation/controllers/reproduction.controller");
const repro_protocol_controller_1 = require("./presentation/controllers/repro-protocol.controller");
const lactation_controller_1 = require("./presentation/lactation.controller");
let ReproductionModule = class ReproductionModule {
};
exports.ReproductionModule = ReproductionModule;
exports.ReproductionModule = ReproductionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            animal_events_module_1.AnimalEventsModule,
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            activity_module_1.ActivityModule,
            task_module_1.TaskModule,
            inventory_module_1.InventoryModule,
            calf_module_1.CalfModule,
            farm_settings_module_1.FarmSettingsModule,
            subscription_module_1.SubscriptionModule,
            purchasing_module_1.PurchasingModule,
            (0, common_1.forwardRef)(() => cattle_module_1.CattleModule),
        ],
        controllers: [
            reproduction_controller_1.ReproductionController,
            cattle_reproduction_controller_1.CattleReproductionController,
            repro_protocol_controller_1.ReproProtocolController,
            lactation_controller_1.LactationController,
        ],
        providers: [
            reproduction_service_1.ReproductionService,
            reproduction_derivation_service_1.ReproductionDerivationService,
            reproduction_edit_service_1.ReproductionEditService,
            reproduction_calving_edit_service_1.ReproductionCalvingEditService,
            repro_protocol_service_1.ReproProtocolService,
            lactation_stats_service_1.LactationStatsService,
            lactation_economics_service_1.LactationEconomicsService,
            reproduction_events_handler_1.ReproductionEventHandler,
        ],
        exports: [reproduction_service_1.ReproductionService, reproduction_derivation_service_1.ReproductionDerivationService],
    })
], ReproductionModule);
//# sourceMappingURL=reproduction.module.js.map