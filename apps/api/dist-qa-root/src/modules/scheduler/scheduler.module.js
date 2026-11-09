"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const notification_module_1 = require("../notification/notification.module");
const subscription_module_1 = require("../subscription/subscription.module");
const renewal_module_1 = require("../renewal/renewal.module");
const billing_module_1 = require("../billing/billing.module");
const finance_v2_accounts_module_1 = require("../finance-v2/accounts/finance-v2-accounts.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const health_module_1 = require("../health/health.module");
const task_module_1 = require("../task/task.module");
const feed_module_1 = require("../feed/feed.module");
const farm_time_module_1 = require("src/common/farm-time/farm-time.module");
const animal_events_module_1 = require("../animal-events/animal-events.module");
const scheduler_service_1 = require("./application/services/scheduler.service");
const overdue_nag_service_1 = require("./application/services/overdue-nag.service");
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            notification_module_1.NotificationModule,
            subscription_module_1.SubscriptionModule,
            renewal_module_1.RenewalModule,
            billing_module_1.BillingModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
            farm_settings_module_1.FarmSettingsModule,
            health_module_1.HealthModule,
            task_module_1.TaskModule,
            feed_module_1.FeedModule,
            farm_time_module_1.FarmTimeModule,
            animal_events_module_1.AnimalEventsModule,
        ],
        providers: [scheduler_service_1.SchedulerService, overdue_nag_service_1.OverdueNagService],
        exports: [scheduler_service_1.SchedulerService],
    })
], SchedulerModule);
//# sourceMappingURL=scheduler.module.js.map