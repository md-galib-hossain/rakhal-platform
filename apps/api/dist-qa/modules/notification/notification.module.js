"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const metrics_module_1 = require("src/core/observability/metrics/metrics.module");
const bullmq_schedule_queue_adapter_1 = require("./application/queue/bullmq-schedule-queue.adapter");
const notification_clock_1 = require("./application/queue/notification-clock");
const occurrence_processor_1 = require("./application/queue/occurrence.processor");
const schedule_queue_port_1 = require("./application/queue/schedule-queue.port");
const source_resolver_registry_1 = require("./application/resolvers/source-resolver.registry");
const notification_scheduler_service_1 = require("./application/services/notification-scheduler.service");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const notification_service_1 = require("./application/services/notification.service");
const notification_delivery_service_1 = require("./application/services/notification-delivery.service");
const channel_router_service_1 = require("./application/services/channel-router.service");
const device_token_service_1 = require("./application/services/device-token.service");
const telegram_link_service_1 = require("./application/services/telegram-link.service");
const fcm_push_provider_1 = require("./application/channels/fcm-push.provider");
const telegram_bot_provider_1 = require("./application/channels/telegram-bot.provider");
const channel_provider_port_1 = require("./application/channels/channel-provider.port");
const notification_controller_1 = require("./presentation/controllers/notification.controller");
const telegram_link_controller_1 = require("./presentation/controllers/telegram-link.controller");
const notification_schedule_controller_1 = require("./presentation/controllers/notification-schedule.controller");
const notification_schedule_service_1 = require("./application/services/notification-schedule.service");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            config_1.ConfigModule.forFeature(env_1.telegramConfig),
            metrics_module_1.MetricsModule,
            bullmq_1.BullModule.registerQueue({ name: schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE }),
        ],
        controllers: [
            notification_controller_1.NotificationController,
            telegram_link_controller_1.TelegramLinkController,
            notification_schedule_controller_1.NotificationScheduleController,
        ],
        providers: [
            source_resolver_registry_1.SourceResolverRegistry,
            notification_scheduler_service_1.NotificationScheduler,
            notification_schedule_service_1.NotificationScheduleService,
            occurrence_processor_1.OccurrenceProcessor,
            occurrence_processor_1.OccurrenceWorker,
            { provide: schedule_queue_port_1.SCHEDULE_QUEUE_PORT, useClass: bullmq_schedule_queue_adapter_1.BullmqScheduleQueue },
            { provide: notification_clock_1.NOTIFICATION_CLOCK, useValue: notification_clock_1.systemNotificationClock },
            { provide: notification_clock_1.NV2_FLAG, useValue: { enabled: env_1.env.NV2_ENABLED } },
            notification_service_1.NotificationService,
            notification_delivery_service_1.NotificationDeliveryService,
            channel_router_service_1.ChannelRouterService,
            device_token_service_1.DeviceTokenService,
            telegram_link_service_1.TelegramLinkService,
            fcm_push_provider_1.FcmPushProvider,
            telegram_bot_provider_1.TelegramBotProvider,
            {
                provide: channel_provider_port_1.CHANNEL_PROVIDERS,
                useFactory: (fcm, telegram) => [
                    fcm,
                    telegram,
                ],
                inject: [fcm_push_provider_1.FcmPushProvider, telegram_bot_provider_1.TelegramBotProvider],
            },
        ],
        exports: [notification_service_1.NotificationService, notification_scheduler_service_1.NotificationScheduler, source_resolver_registry_1.SourceResolverRegistry],
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map