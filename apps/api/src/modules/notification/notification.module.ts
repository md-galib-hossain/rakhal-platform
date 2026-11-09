import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { telegramConfig } from 'src/core/config/env';
import { MetricsModule } from 'src/core/observability/metrics/metrics.module';
import { BullmqScheduleQueue } from './application/queue/bullmq-schedule-queue.adapter';
import {
  NOTIFICATION_CLOCK,
  systemNotificationClock,
} from './application/queue/notification-clock';
import {
  OccurrenceProcessor,
  OccurrenceWorker,
} from './application/queue/occurrence.processor';
import {
  NOTIFICATION_OCCURRENCE_QUEUE,
  SCHEDULE_QUEUE_PORT,
} from './application/queue/schedule-queue.port';
import { SourceResolverRegistry } from './application/resolvers/source-resolver.registry';
import { NotificationScheduler } from './application/services/notification-scheduler.service';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { NotificationService } from './application/services/notification.service';
import { NotificationDeliveryService } from './application/services/notification-delivery.service';
import { ChannelRouterService } from './application/services/channel-router.service';
import { DeviceTokenService } from './application/services/device-token.service';
import { TelegramLinkService } from './application/services/telegram-link.service';
import { FcmPushProvider } from './application/channels/fcm-push.provider';
import { TelegramBotProvider } from './application/channels/telegram-bot.provider';
import {
  ChannelProvider,
  CHANNEL_PROVIDERS,
} from './application/channels/channel-provider.port';
import { NotificationController } from './presentation/controllers/notification.controller';
import { TelegramLinkController } from './presentation/controllers/telegram-link.controller';
import { NotificationScheduleController } from './presentation/controllers/notification-schedule.controller';
import { NotificationScheduleService } from './application/services/notification-schedule.service';

/**
 * Notification engine (PRD §20 / API §17). Exports `NotificationService` so other
 * modules emit via `notifyUsers(...)` / `notifyOwnersAndManagers(...)`. Delivery
 * is channel-agnostic: the `CHANNEL_PROVIDERS` array is the **registry of outbound
 * channels** — add SMS/WhatsApp/Telegram by implementing `ChannelProvider` and
 * listing the class here; nothing else changes. Today only FCM push is real;
 * the others are deferred (no provider configured → in-app still delivers).
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ConfigModule.forFeature(telegramConfig),
    MetricsModule,
    // Notifications v2 (RAKHAL-493): the root BullMQ connection comes from OutboxModule (@Global).
    BullModule.registerQueue({ name: NOTIFICATION_OCCURRENCE_QUEUE }),
  ],
  controllers: [
    NotificationController,
    TelegramLinkController,
    NotificationScheduleController,
  ],
  providers: [
    // Notifications v2 scheduling engine (RAKHAL-493). No producer is wired; domain modules register resolvers.
    SourceResolverRegistry,
    NotificationScheduler,
    NotificationScheduleService,
    OccurrenceProcessor,
    OccurrenceWorker,
    { provide: SCHEDULE_QUEUE_PORT, useClass: BullmqScheduleQueue },
    { provide: NOTIFICATION_CLOCK, useValue: systemNotificationClock },
    NotificationService,
    NotificationDeliveryService,
    ChannelRouterService,
    DeviceTokenService,
    TelegramLinkService,
    FcmPushProvider,
    TelegramBotProvider,
    {
      provide: CHANNEL_PROVIDERS,
      useFactory: (
        fcm: FcmPushProvider,
        telegram: TelegramBotProvider,
      ): ChannelProvider[] => [
        fcm,
        telegram,
        // ↓ register future channels here (SMS, WhatsApp)
      ],
      inject: [FcmPushProvider, TelegramBotProvider],
    },
  ],
  exports: [NotificationService, NotificationScheduler, SourceResolverRegistry],
})
export class NotificationModule {}
