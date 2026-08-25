import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { FinanceV2AccountsModule } from 'src/modules/finance-v2/accounts/finance-v2-accounts.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { TransferService } from './application/transfer.service';
import { TransferController } from './presentation/controllers/transfer.controller';

/**
 * Finance V2 → Transfers (RAKHAL-338, `FINANCE_V2_DESIGN.md` §4.4,
 * Phase 2 — Money movement). `FinanceV2LedgerModule` is `@Global()` so
 * `LedgerAccountService`/`JournalService` resolve without an import here,
 * same as `FinanceV2PaymentsModule`; `FinanceV2AccountsModule` is imported
 * directly for `FinancialAccountService.assertAccountActive` and
 * `BalanceService.getAccountBalance`.
 *
 * Imports `AuthModule`/`TenantAccessModule`/`PermissionModule`/
 * `SubscriptionModule` so the controller's guard chain
 * (JwtAuthGuard/SessionGuard/FarmContextGuard/PermissionGuard/
 * SubscriptionGuard) resolves, mirroring `FinanceV2PaymentsModule`.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    FinanceV2AccountsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class FinanceV2TransfersModule {}
