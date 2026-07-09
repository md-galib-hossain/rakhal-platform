import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminTokenService } from './application/services/admin-token.service';
import { AdminAuthService } from './application/services/admin-auth.service';
import { AdminAuditService } from './application/services/admin-audit.service';
import { PlatformAdminGuard } from './presentation/guards/platform-admin.guard';
import { AdminAuthController } from './presentation/controllers/admin-auth.controller';
import { AdminBillingController } from './presentation/controllers/admin-billing.controller';
import { AdminReconciliationController } from './presentation/controllers/admin-reconciliation.controller';

/**
 * Rakhal Admin (`admin-api`) — RAKHAL-224 (PRD §32.5 / ADR-016/019). The
 * platform-admin identity + guard + the monetization console. Imports
 * `BillingModule`/`SubscriptionModule` to reuse the coupon/referral/plan
 * services (no reverse dep — billing knows nothing about admin) and `AuthModule`
 * for `PasswordService`. This is the seed of Milestone 13's admin panel;
 * RAKHAL-225 extends the identity with sessions/2FA/RBAC.
 */
@Module({
  imports: [LoggerModule, AuthModule, BillingModule, SubscriptionModule],
  controllers: [
    AdminAuthController,
    AdminBillingController,
    AdminReconciliationController,
  ],
  providers: [
    AdminTokenService,
    AdminAuthService,
    AdminAuditService,
    PlatformAdminGuard,
  ],
  exports: [PlatformAdminGuard, AdminTokenService, AdminAuditService],
})
export class AdminModule {}
