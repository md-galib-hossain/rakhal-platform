import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FeedModule } from '../feed/feed.module';
import { AdminTokenService } from './application/services/admin-token.service';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminAuditService } from './application/services/admin-audit.service';
import { AdminTotpService } from './application/services/admin-totp.service';
import { PlatformAdminGuard } from './presentation/guards/platform-admin.guard';
import { AdminPermissionGuard } from './presentation/guards/admin-permission.guard';
import { AdminTwoFactorSetupGuard } from './presentation/guards/admin-two-factor-setup.guard';
import { AdminIpAllowlistGuard } from './presentation/guards/admin-ip-allowlist.guard';
import { AdminSessionService } from './application/services/admin-session.service';
import { AdminManagementService } from './application/services/admin-management.service';
import { AdminAdminsController } from './presentation/controllers/admin-admins.controller';
import { AdminDirectoryController } from './presentation/controllers/admin-directory.controller';
import { AdminSupportActionsController } from './presentation/controllers/admin-support-actions.controller';
import { AdminOpsController } from './presentation/controllers/admin-ops.controller';
import { AdminSubscriptionsController } from './presentation/controllers/admin-subscriptions.controller';
import { AdminAnalyticsController } from './presentation/controllers/admin-analytics.controller';
import { AdminSubscriptionsService } from './application/services/admin-subscriptions.service';
import { AdminAnalyticsService } from './application/services/admin-analytics.service';
import { AdminConfigController } from './presentation/controllers/admin-config.controller';
import { AdminOpsService } from './application/services/admin-ops.service';
import { AdminPlatformConfigService } from './application/services/admin-platform-config.service';
import { BullModule } from '@nestjs/bullmq';
import { OUTBOX_QUEUE } from 'src/common/outbox/infrastructure/queue/outbox.queue.constants';
import { EMAIL_QUEUE } from 'src/modules/email/infrastructure/queue/email.queue.constants';
import { AdminSupportActionsService } from './application/services/admin-support-actions.service';
import { AdminDirectoryService } from './application/services/admin-directory.service';
import { AdminAuthController } from './presentation/controllers/admin-auth.controller';
import { AdminBillingController } from './presentation/controllers/admin-billing.controller';
import { AdminReconciliationController } from './presentation/controllers/admin-reconciliation.controller';
import { AdminAuditController } from './presentation/controllers/admin-audit.controller';
import { AdminHealthController } from './presentation/controllers/admin-health.controller';
import { AdminFeedIngredientController } from './presentation/controllers/admin-feed-ingredient.controller';
import { AdminRequirementPresetController } from './presentation/controllers/admin-requirement-preset.controller';
import { AdminSystemController } from './presentation/controllers/admin-system.controller';
import { AdminInsightsController } from './presentation/controllers/admin-insights.controller';
import { AdminInsightsService } from './application/services/admin-insights.service';

/**
 * Rakhal Admin (`admin-api`) — RAKHAL-224 (PRD §32.5 / ADR-016/019). The
 * platform-admin identity + guard + the monetization console. Imports
 * `BillingModule`/`SubscriptionModule` to reuse the coupon/referral/plan
 * services (no reverse dep — billing knows nothing about admin) and `AuthModule`
 * for `PasswordService`. This is the seed of Milestone 13's admin panel;
 * RAKHAL-225 extends the identity with sessions/2FA/RBAC. `FeedModule` is
 * imported for the Feed Ingredient Master (RAKHAL-233) — reuses
 * `FeedIngredientService` directly, same "consume the owning module's service"
 * pattern as billing/subscription above (no reverse dep — feed knows nothing
 * about admin).
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    BillingModule,
    SubscriptionModule,
    FeedModule,
    BullModule.registerQueue(
      { name: OUTBOX_QUEUE },
      { name: EMAIL_QUEUE },
    ),
  ],
  controllers: [
    AdminAuthController,
    AdminBillingController,
    AdminReconciliationController,
    AdminAuditController,
    AdminHealthController,
    AdminFeedIngredientController,
    AdminRequirementPresetController,
    AdminSystemController,
    AdminAdminsController,
    AdminDirectoryController,
    AdminSupportActionsController,
    AdminOpsController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
    AdminInsightsController,
    AdminConfigController,
  ],
  providers: [
    AdminTokenService,
    AdminSessionService,
    AdminManagementService,
    AdminDirectoryService,
    AdminSupportActionsService,
    AdminOpsService,
    AdminSubscriptionsService,
    AdminAnalyticsService,
    AdminInsightsService,
    AdminPlatformConfigService,
    AdminAuthService,
    AdminAuditService,
    AdminTotpService,
    PlatformAdminGuard,
    AdminPermissionGuard,
    AdminTwoFactorSetupGuard,
    AdminIpAllowlistGuard,
  ],
  exports: [
    PlatformAdminGuard,
    AdminTokenService,
    AdminAuditService,
    AdminSessionService,
    AdminPlatformConfigService,
  ],
})
export class AdminModule {}
