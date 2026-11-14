import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { SalesModule } from 'src/modules/sales/sales.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { RecordManureSaleUseCase } from './record-manure-sale.use-case';
import { ManureSaleController } from '../../../presentation/controllers/manure-sale.controller';

/**
 * `RecordManureSale` use case module (RAKHAL-347). Registered directly in
 * `AppModule` so `RecordManureSaleUseCase` is resolvable by e2e tests via
 * `app.get(...)`, the same way every other Finance V2 module is wired in.
 *
 * Imports `SalesModule` for `SaleService` (document creation),
 * `FinanceV2ReceivablesModule` for `ReceivableService`, and
 * `FinanceV2PaymentsModule` for `PaymentService`. `PrismaService`/
 * `LedgerAccountService`/`JournalService` resolve via their own `@Global()`
 * modules already imported elsewhere in `AppModule`.
 *
 * RAKHAL-376 added `ManureSaleController` (`POST /sales/manure`) here once
 * the route-less-use-case gap was closed — same precedent `SellAnimalModule`/
 * `AnimalSaleController` (RAKHAL-399) already set — plus the four guard-
 * chain modules (`AuthModule`/`TenantAccessModule`/`PermissionModule`/
 * `SubscriptionModule`) the new controller's `@UseGuards` chain needs, which
 * this module didn't require while it had no controller.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    SalesModule,
    FinanceV2ReceivablesModule,
    FinanceV2PaymentsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  controllers: [ManureSaleController],
  providers: [RecordManureSaleUseCase],
  exports: [RecordManureSaleUseCase],
})
export class SellManureModule {}
