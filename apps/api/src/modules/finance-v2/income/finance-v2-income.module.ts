import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { FinanceV2AccountsModule } from 'src/modules/finance-v2/accounts/finance-v2-accounts.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { IncomeService } from './application/income.service';
import { IncomeController } from './presentation/controllers/income.controller';

/**
 * Finance V2 → Other Income (RAKHAL-350, `FINANCE_V2_DESIGN.md` §1.3, §5.1,
 * Phase 4-8). `FinanceV2LedgerModule` (`LedgerAccountService`/
 * `JournalService`) is `@Global()` so it resolves without an import here,
 * same as every other Finance V2 submodule; `FinanceV2AccountsModule` is
 * imported directly for `FinancialAccountService.assertAccountActive`, same
 * consumption pattern as `FinanceV2PaymentsModule`.
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
    FinanceV2AccountsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class FinanceV2IncomeModule {}
