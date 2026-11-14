import { forwardRef, Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { FinanceV2AccountsModule } from 'src/modules/finance-v2/accounts/finance-v2-accounts.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { PurchasingModule } from 'src/modules/purchasing/purchasing.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { PaymentService } from './application/payment.service';
import { PaymentController } from './presentation/controllers/payment.controller';

/**
 * Finance V2 → Payments (RAKHAL-337, `FINANCE_V2_DESIGN.md` §4.5, §4.6,
 * Phase 2 — Money movement). `FinanceV2LedgerModule` (`LedgerAccountService`/
 * `JournalService`) is `@Global()` so it resolves without an import here,
 * same as `FinanceV2AccountsModule` itself; `FinanceV2AccountsModule` is
 * imported directly for `FinancialAccountService.assertAccountActive`.
 * `FinanceV2ReceivablesModule` is imported directly too (RAKHAL-340) so
 * `PaymentService.allocatePayment` can call `ReceivableService.
 * assertWithinOutstanding`/`closeIfSettled` — the real cross-payment
 * over-allocation guard that only became possible once `Receivable` existed.
 *
 * `PurchasingModule` is imported the same way (RAKHAL-349) so
 * `allocatePayment` can call the mirror-image `PayableService.
 * assertWithinOutstanding`/`closeIfSettled` for `payableId` lines —
 * wrapped in `forwardRef()` because `PurchasingModule` itself imports this
 * module back (for `PaySupplierUseCase`'s own `PaymentService` dependency),
 * a genuine circular module reference Nest resolves lazily.
 *
 * Imports `AuthModule`/`TenantAccessModule`/`PermissionModule`/
 * `SubscriptionModule` so the controller's guard chain
 * (JwtAuthGuard/SessionGuard/FarmContextGuard/PermissionGuard/
 * SubscriptionGuard) resolves, mirroring `FinanceV2AccountsModule`.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    FinanceV2AccountsModule,
    FinanceV2ReceivablesModule,
    forwardRef(() => PurchasingModule),
    // RAKHAL-353: ActivityLogService for the new money-moving log entries.
    ActivityModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class FinanceV2PaymentsModule {}
