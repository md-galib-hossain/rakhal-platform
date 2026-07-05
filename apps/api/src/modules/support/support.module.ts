import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MediaModule } from '../media/media.module';
import { AdminModule } from '../admin/admin.module';
import { FeedbackService } from './application/services/feedback.service';
import { TrialAbuseService } from './application/services/trial-abuse.service';
import { FeedbackController } from './presentation/controllers/feedback.controller';
import { AdminFeedbackController } from './presentation/controllers/admin-feedback.controller';

/**
 * Support & trust (RAKHAL-242, PRD §36.7). The customer feedback endpoint + the
 * admin triage inbox (behind `PlatformAdminGuard` via `AdminModule`), plus the
 * `TrialAbuseService` (one-trial-per-owner guard) exported for `FarmModule` to
 * call at farm bootstrap. `MediaModule` powers the optional feedback screenshot.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    AuditModule,
    SubscriptionModule,
    MediaModule,
    AdminModule,
  ],
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService, TrialAbuseService],
  exports: [TrialAbuseService],
})
export class SupportModule {}
