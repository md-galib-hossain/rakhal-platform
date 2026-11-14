import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { FinancialAccountService } from './application/financial-account.service';
import { BalanceService } from './application/balance.service';
import { FinancialAccountController } from './presentation/controllers/financial-account.controller';
import { BalanceController } from './presentation/controllers/balance.controller';

/**
 * Finance V2 → Financial Accounts (RAKHAL-335, `FINANCE_V2_DESIGN.md` §3,
 * §4.4, Phase 1). The farmer-facing successor to `WalletTransaction` — named
 * Cash/Bank/MFS accounts, each backed by its own `LedgerAccount` (RAKHAL-333)
 * and posting through the journal engine (RAKHAL-334) for its opening
 * balance. `FinanceV2LedgerModule` is `@Global()` so `LedgerAccountService`/
 * `JournalService` resolve into `FinancialAccountService` without importing
 * it here — same consumption pattern `FarmService` already uses.
 *
 * Imports `AuthModule`/`TenantAccessModule`/`PermissionModule`/
 * `SubscriptionModule` so the controller's guard chain
 * (JwtAuthGuard/SessionGuard/FarmContextGuard/PermissionGuard/
 * SubscriptionGuard) resolves, mirroring `InventoryModule`.
 *
 * Also hosts `BalanceService`/`BalanceController` (RAKHAL-336) — the balance
 * projection reads the same `FinancialAccount` rows this module owns, so it
 * lives here rather than in a new module (per RAKHAL-336's own Lane).
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entries.
    ActivityModule,
  ],
  controllers: [FinancialAccountController, BalanceController],
  providers: [FinancialAccountService, BalanceService],
  exports: [FinancialAccountService, BalanceService],
})
export class FinanceV2AccountsModule {}
