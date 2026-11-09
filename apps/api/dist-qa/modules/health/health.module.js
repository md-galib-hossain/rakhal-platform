"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthModule = void 0;
const animal_events_module_1 = require("../animal-events/animal-events.module");
const health_events_handler_1 = require("./application/events/health-events.handler");
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const activity_module_1 = require("../activity/activity.module");
const inventory_module_1 = require("../inventory/inventory.module");
const task_module_1 = require("../task/task.module");
const cattle_module_1 = require("../cattle/cattle.module");
const notification_module_1 = require("../notification/notification.module");
const health_service_1 = require("./application/services/health.service");
const health_reminder_service_1 = require("./application/services/health-reminder.service");
const protocol_stock_service_1 = require("./application/services/protocol-stock.service");
const health_cycle_service_1 = require("./application/services/health-cycle.service");
const health_outcomes_service_1 = require("./application/services/health-outcomes.service");
const health_plan_stats_service_1 = require("./application/services/health-plan-stats.service");
const health_rounds_service_1 = require("./application/services/health-rounds.service");
const health_step_source_resolver_1 = require("./application/resolvers/health-step-source.resolver");
const health_step_notification_producer_1 = require("./application/resolvers/health-step-notification.producer");
const cattle_health_controller_1 = require("./presentation/controllers/cattle-health.controller");
const health_controller_1 = require("./presentation/controllers/health.controller");
const subscription_module_1 = require("../subscription/subscription.module");
const purchasing_module_1 = require("../purchasing/purchasing.module");
let HealthModule = class HealthModule {
};
exports.HealthModule = HealthModule;
exports.HealthModule = HealthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            animal_events_module_1.AnimalEventsModule,
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            activity_module_1.ActivityModule,
            inventory_module_1.InventoryModule,
            task_module_1.TaskModule,
            notification_module_1.NotificationModule,
            subscription_module_1.SubscriptionModule,
            cattle_module_1.CattleModule,
            purchasing_module_1.PurchasingModule,
        ],
        controllers: [health_controller_1.HealthController, cattle_health_controller_1.CattleHealthController],
        providers: [
            health_events_handler_1.HealthEventHandler,
            health_service_1.HealthService,
            protocol_stock_service_1.ProtocolStockService,
            health_cycle_service_1.HealthCycleService,
            health_reminder_service_1.HealthReminderService,
            health_outcomes_service_1.HealthOutcomesService,
            health_plan_stats_service_1.HealthPlanStatsService,
            health_rounds_service_1.HealthRoundsService,
            health_step_source_resolver_1.HealthStepSourceResolver,
            health_step_notification_producer_1.HealthStepNotificationProducer,
        ],
        exports: [
            health_service_1.HealthService,
            protocol_stock_service_1.ProtocolStockService,
            health_cycle_service_1.HealthCycleService,
            health_reminder_service_1.HealthReminderService,
            health_outcomes_service_1.HealthOutcomesService,
            health_plan_stats_service_1.HealthPlanStatsService,
            health_rounds_service_1.HealthRoundsService,
        ],
    })
], HealthModule);
//# sourceMappingURL=health.module.js.map