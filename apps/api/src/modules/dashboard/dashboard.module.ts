import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { MilkModule } from '../milk/milk.module';
import { HealthModule } from '../health/health.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { FeedModule } from '../feed/feed.module';
import { FinanceV2AccountsModule } from '../finance-v2/accounts/finance-v2-accounts.module';
import { DashboardService } from './application/services/dashboard.service';
import { DashboardController } from './presentation/controllers/dashboard.controller';

/**
 * Dashboard (PRD §7). Read-only cross-module aggregator. Imports the feature
 * modules whose services it composes (Milk/Health); all other widgets
 * are direct farm-scoped Prisma reads via the global PrismaModule.
 *
 * RAKHAL-354: `FinanceModule` (V1) dropped from this list — the
 * cash-runway/cost-per-litre widget (`financeSnapshot()`) now sources
 * liquidity from Finance V2's `BalanceService` (`FinanceV2AccountsModule`)
 * and expense totals from `ledgerCategoryNet` (`src/common/finance/txn-filters.ts`)
 * instead of the deleted V1 `FinanceService.highlights()`.
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    MilkModule,
    HealthModule,
    FarmSettingsModule,
    FeedModule,
    FinanceV2AccountsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
