import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { EmailModule } from '../email/email.module';
import { SubscriptionAccessService } from './application/services/subscription-access.service';
import { PlanCatalogueService } from './application/services/plan-catalogue.service';
import { SubscriptionLifecycleService } from './application/services/subscription-lifecycle.service';
import { SubscriptionFeatureGuard } from './presentation/guards/subscription-feature.guard';
import { SubscriptionGuard } from './presentation/guards/subscription.guard';
import { PlanController } from './presentation/controllers/plan.controller';
import { SubscriptionController } from './presentation/controllers/subscription.controller';

/**
 * Subscription / entitlement module (PRD §31). Provides the cached entitlement
 * resolver + the two guards (baseline `SubscriptionGuard`, `@RequireFeature`
 * `SubscriptionFeatureGuard`), the plan catalogue (public `GET /plans`), the
 * self-serve `GET /subscription`, and the lifecycle service (trial + expiry).
 *
 * Imports Auth + TenantAccess so the `SubscriptionController` guard chain
 * (JwtAuthGuard / SessionGuard / FarmContextGuard) resolves.
 */
@Module({
  imports: [LoggerModule, AuthModule, TenantAccessModule, EmailModule],
  controllers: [PlanController, SubscriptionController],
  providers: [
    SubscriptionAccessService,
    PlanCatalogueService,
    SubscriptionLifecycleService,
    SubscriptionFeatureGuard,
    SubscriptionGuard,
  ],
  exports: [
    SubscriptionAccessService,
    PlanCatalogueService,
    SubscriptionLifecycleService,
    SubscriptionFeatureGuard,
    SubscriptionGuard,
  ],
})
export class SubscriptionModule {}
