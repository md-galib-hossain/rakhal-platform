import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BillingModule } from '../billing/billing.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { FarmService } from './application/services/farm.service';
import { FarmController } from './presentation/controllers/farm.controller';

/**
 * Farm bootstrap module (RAKHAL-021, partial): create a farm + owner membership
 * so the RBAC/tenant chain has something to resolve. Imports AuthModule for the
 * JwtAuthGuard / SessionGuard used by the controller, SubscriptionModule to
 * auto-provision the trial on farm creation (SUB-01), BillingModule for
 * `ReferralService.bindReferral` (REF-01 attribution, RAKHAL-223), and
 * ComplianceModule for the legal-consent gate (LGL-02, RAKHAL-236).
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    SubscriptionModule,
    BillingModule,
    ComplianceModule,
  ],
  controllers: [FarmController],
  providers: [FarmService],
  exports: [FarmService],
})
export class FarmModule {}
