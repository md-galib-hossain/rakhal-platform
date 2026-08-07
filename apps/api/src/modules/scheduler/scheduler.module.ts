import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { RenewalModule } from '../renewal/renewal.module';
import { BillingModule } from '../billing/billing.module';
import { FinanceModule } from '../finance/finance.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { HealthModule } from '../health/health.module';
import { TaskModule } from '../task/task.module';
import { SchedulerService } from './application/services/scheduler.service';

/**
 * Scheduled jobs (RAKHAL-095). Hosts the daily notification sweeps + the
 * subscription expiry sweep (RAKHAL-218). No controller — driven by
 * `@nestjs/schedule` cron (registered globally via `ScheduleModule` in
 * AppModule). Reads data tables directly via Prisma; emits via NotificationModule.
 */
@Module({
  imports: [
    LoggerModule,
    NotificationModule,
    SubscriptionModule,
    RenewalModule,
    BillingModule,
    FinanceModule,
    FarmSettingsModule,
    HealthModule,
    TaskModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
