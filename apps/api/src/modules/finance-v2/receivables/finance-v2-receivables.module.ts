import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { ReceivableService } from './application/receivable.service';
import { ReceivableController } from './presentation/controllers/receivable.controller';

/**
 * Finance V2 → Receivables (RAKHAL-340, `FINANCE_V2_DESIGN.md` §4.3, §4.6,
 * Phase 3 — Sales foundation). `ReceivableService` is exported so
 * `FinanceV2PaymentsModule` can import this module and call
 * `assertWithinOutstanding`/`closeIfSettled` from `PaymentService.
 * allocatePayment` — closing the cross-payment over-allocation gap
 * RAKHAL-337 could not close before this model existed — and so the
 * sale-type use cases (RAKHAL-342/345/346/347) can import this module and
 * call `createReceivable` as a later step of their own `$transaction`.
 *
 * Imports `AuthModule`/`TenantAccessModule`/`PermissionModule`/
 * `SubscriptionModule` so the controller's guard chain
 * (JwtAuthGuard/SessionGuard/FarmContextGuard/PermissionGuard/
 * SubscriptionGuard) resolves, mirroring every other Finance V2 module.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
  ],
  controllers: [ReceivableController],
  providers: [ReceivableService],
  exports: [ReceivableService],
})
export class FinanceV2ReceivablesModule {}
