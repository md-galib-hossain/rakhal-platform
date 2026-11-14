import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';
import { RenewalReminderService } from './application/services/renewal-reminder.service';

/**
 * Renewal reminders + win-back (RAKHAL-240, PRD §36.5). Exports
 * `RenewalReminderService` for the scheduler to drive daily. In-app via
 * NotificationModule, email via the EmailModule transactional pipeline.
 */
@Module({
  imports: [LoggerModule, NotificationModule, EmailModule],
  providers: [RenewalReminderService],
  exports: [RenewalReminderService],
})
export class RenewalModule {}
