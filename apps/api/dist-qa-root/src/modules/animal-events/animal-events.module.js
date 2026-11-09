"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalEventsModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const subscription_module_1 = require("../subscription/subscription.module");
const event_registry_1 = require("./domain/event-registry");
const animal_event_types_service_1 = require("./application/services/animal-event-types.service");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const eligibility_service_1 = require("./application/services/eligibility.service");
const animal_event_write_service_1 = require("./application/services/animal-event-write.service");
const event_handler_1 = require("./application/event-handler");
const task_module_1 = require("../task/task.module");
const activity_module_1 = require("../activity/activity.module");
const animal_event_edit_service_1 = require("./application/services/animal-event-edit.service");
const custom_event_type_service_1 = require("./application/services/custom-event-type.service");
const custom_types_controller_1 = require("./presentation/controllers/custom-types.controller");
const animal_event_anchor_checker_1 = require("./application/anchors/animal-event-anchor.checker");
const follow_up_service_1 = require("./application/services/follow-up.service");
const follow_up_reminder_service_1 = require("./application/services/follow-up-reminder.service");
const bulk_event_service_1 = require("./application/services/bulk-event.service");
const notification_module_1 = require("../notification/notification.module");
const farm_time_module_1 = require("src/common/farm-time/farm-time.module");
const follow_up_rules_controller_1 = require("./presentation/controllers/follow-up-rules.controller");
const timeline_service_1 = require("./application/services/timeline.service");
const animal_events_controller_1 = require("./presentation/controllers/animal-events.controller");
const cattle_events_controller_1 = require("./presentation/controllers/cattle-events.controller");
let AnimalEventsModule = class AnimalEventsModule {
};
exports.AnimalEventsModule = AnimalEventsModule;
exports.AnimalEventsModule = AnimalEventsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            activity_module_1.ActivityModule,
            task_module_1.TaskModule,
            farm_settings_module_1.FarmSettingsModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            subscription_module_1.SubscriptionModule,
            notification_module_1.NotificationModule,
            farm_time_module_1.FarmTimeModule,
        ],
        controllers: [
            animal_events_controller_1.AnimalEventsController,
            cattle_events_controller_1.CattleEventsController,
            follow_up_rules_controller_1.FollowUpRulesController,
            custom_types_controller_1.CustomTypesController,
        ],
        providers: [
            {
                provide: animal_event_types_service_1.EVENT_REGISTRY,
                useFactory: () => event_registry_1.EventRegistry.withCatalogue(),
            },
            animal_event_types_service_1.AnimalEventTypesService,
            timeline_service_1.TimelineService,
            eligibility_service_1.EligibilityService,
            event_handler_1.EventHandlerRegistry,
            animal_event_write_service_1.AnimalEventWriteService,
            follow_up_service_1.FollowUpService,
            follow_up_reminder_service_1.FollowUpReminderService,
            custom_event_type_service_1.CustomEventTypeService,
            animal_event_edit_service_1.AnimalEventEditService,
            bulk_event_service_1.BulkEventService,
            animal_event_anchor_checker_1.AnimalEventAnchorChecker,
        ],
        exports: [
            follow_up_reminder_service_1.FollowUpReminderService,
            animal_event_types_service_1.EVENT_REGISTRY,
            animal_event_types_service_1.AnimalEventTypesService,
            timeline_service_1.TimelineService,
            eligibility_service_1.EligibilityService,
            event_handler_1.EventHandlerRegistry,
            animal_event_write_service_1.AnimalEventWriteService,
            follow_up_service_1.FollowUpService,
        ],
    })
], AnimalEventsModule);
//# sourceMappingURL=animal-events.module.js.map