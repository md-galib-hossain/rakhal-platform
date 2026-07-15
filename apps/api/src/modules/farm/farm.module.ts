import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { SupportModule } from '../support/support.module';
import { EmailModule } from '../email/email.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { FarmService } from './application/services/farm.service';
import { FarmController } from './presentation/controllers/farm.controller';

/**
 * Farm bootstrap module (RAKHAL-021, partial): create a farm + owner membership
 * so the RBAC/tenant chain has something to resolve. Imports AuthModule for the
 * JwtAuthGuard / SessionGuard used by the controller, SupportModule for the
 * `TrialAbuseService` that gates trial provisioning at farm creation
 * (SUB-01/SUP-02), BillingModule for `ReferralService.bindReferral` (REF-01
 * attribution, RAKHAL-223), ComplianceModule for the legal-consent gate
 * (LGL-02, RAKHAL-236), and TenantAccessModule for `FarmContextGuard` (used
 * only by the `DELETE /farms` soft-delete route — the rest of this controller
 * is bootstrap-scoped and doesn't need a resolved farm context).
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    SupportModule,
    BillingModule,
    ComplianceModule,
    EmailModule,
    TenantAccessModule,
  ],
  controllers: [FarmController],
  providers: [FarmService],
  exports: [FarmService],
})
export class FarmModule {}
