import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { SalesModule } from 'src/modules/sales/sales.module';
import { CattleModule } from 'src/modules/cattle/cattle.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { SellAnimalUseCase } from './sell-animal.use-case';
import { AnimalSaleController } from '../../../presentation/controllers/animal-sale.controller';

/**
 * `SellAnimal` use case module (RAKHAL-345, Sales — `FINANCE_V2_DESIGN.md`
 * §1.1, §4.2). Its own dedicated module rather than adding a provider to
 * `SalesModule` directly — `sales.module.ts`/`sale.service.ts`/`domain/` are
 * RAKHAL-339's lane (read-only for this ticket, only called into), so this
 * new module imports `SalesModule` (for `SaleService`) instead of editing it.
 *
 * `FinanceV2LedgerModule` (`LedgerAccountService`/`JournalService`) is
 * `@Global()` (RAKHAL-334) so it resolves without an explicit import here,
 * same consumption pattern `FinanceV2PaymentsModule` itself already uses.
 *
 * RAKHAL-399 added `AnimalSaleController` (`POST /sales/animal/:cattleId`)
 * here once the frontend wizard needed a real route — see that controller's
 * own doc comment.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    SalesModule,
    CattleModule,
    FinanceV2ReceivablesModule,
    FinanceV2PaymentsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  controllers: [AnimalSaleController],
  providers: [SellAnimalUseCase],
  exports: [SellAnimalUseCase],
})
export class SellAnimalModule {}
