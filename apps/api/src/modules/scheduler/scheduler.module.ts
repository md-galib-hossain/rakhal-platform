import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { NotificationModule } from '../notification/notification.module';
import { SchedulerService } from './application/services/scheduler.service';

/**
 * Scheduled jobs (RAKHAL-095). Hosts the daily notification sweeps. No controller
 * — driven by `@nestjs/schedule` cron (registered globally via `ScheduleModule`
 * in AppModule). Reads data tables directly via Prisma; emits via NotificationModule.
 */
@Module({
  imports: [LoggerModule, NotificationModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
