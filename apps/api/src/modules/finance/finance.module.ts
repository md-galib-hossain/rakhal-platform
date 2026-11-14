import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FinanceV2AccountsModule } from '../finance-v2/accounts/finance-v2-accounts.module';
import { FinanceService } from './application/services/finance.service';
import { FinanceController } from './presentation/controllers/finance.controller';

/**
 * RAKHAL-354: slimmed to the Loans/Fixed-Assets survivor surface — dropped
 * `FarmSettingsModule`/`InventoryModule` (only needed by the deleted
 * `recordTransaction`/`highlights`/`incrementInventoryStock` methods), added
 * `FinanceV2AccountsModule` for `BalanceService` (`assets()`'s liquidity
 * figure). See `FinanceService`'s own doc comment for the full reasoning.
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    FinanceV2AccountsModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
