"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CattleModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const activity_module_1 = require("../activity/activity.module");
const subscription_module_1 = require("../subscription/subscription.module");
const media_module_1 = require("../media/media.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const cattle_events_handler_1 = require("./application/events/cattle-events.handler");
const animal_events_module_1 = require("../animal-events/animal-events.module");
const reproduction_module_1 = require("../reproduction/reproduction.module");
const task_module_1 = require("../task/task.module");
const animal_hold_service_1 = require("./application/services/animal-hold.service");
const animal_upcoming_events_service_1 = require("./application/services/animal-upcoming-events.service");
const bcs_service_1 = require("./application/services/bcs.service");
const breed_service_1 = require("./application/services/breed.service");
const cattle_service_1 = require("./application/services/cattle.service");
const cattle_detail_service_1 = require("./application/services/cattle-detail.service");
const cattle_import_service_1 = require("./application/services/cattle-import.service");
const animal_group_service_1 = require("./application/services/animal-group.service");
const shed_service_1 = require("./application/services/shed.service");
const weight_service_1 = require("./application/services/weight.service");
const animal_hold_controller_1 = require("./presentation/controllers/animal-hold.controller");
const breed_controller_1 = require("./presentation/controllers/breed.controller");
const cattle_controller_1 = require("./presentation/controllers/cattle.controller");
const animal_group_controller_1 = require("./presentation/controllers/animal-group.controller");
const shed_controller_1 = require("./presentation/controllers/shed.controller");
let CattleModule = class CattleModule {
};
exports.CattleModule = CattleModule;
exports.CattleModule = CattleModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            activity_module_1.ActivityModule,
            subscription_module_1.SubscriptionModule,
            media_module_1.MediaModule,
            farm_settings_module_1.FarmSettingsModule,
            animal_events_module_1.AnimalEventsModule,
            (0, common_1.forwardRef)(() => reproduction_module_1.ReproductionModule),
            task_module_1.TaskModule,
        ],
        controllers: [
            cattle_controller_1.CattleController,
            breed_controller_1.BreedController,
            shed_controller_1.ShedController,
            animal_group_controller_1.AnimalGroupController,
            animal_hold_controller_1.AnimalHoldController,
        ],
        providers: [
            cattle_service_1.CattleService,
            bcs_service_1.BcsService,
            weight_service_1.WeightService,
            cattle_detail_service_1.CattleDetailService,
            cattle_import_service_1.CattleImportService,
            breed_service_1.BreedService,
            shed_service_1.ShedService,
            animal_group_service_1.AnimalGroupService,
            animal_hold_service_1.AnimalHoldService,
            animal_upcoming_events_service_1.AnimalUpcomingEventsService,
            cattle_events_handler_1.CattleEventHandler,
        ],
        exports: [
            cattle_service_1.CattleService,
            breed_service_1.BreedService,
            shed_service_1.ShedService,
            cattle_import_service_1.CattleImportService,
            animal_hold_service_1.AnimalHoldService,
        ],
    })
], CattleModule);
//# sourceMappingURL=cattle.module.js.map