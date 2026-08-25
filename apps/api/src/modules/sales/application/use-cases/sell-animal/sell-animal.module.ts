import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { SalesModule } from 'src/modules/sales/sales.module';
import { CattleModule } from 'src/modules/cattle/cattle.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { SellAnimalUseCase } from './sell-animal.use-case';

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
 * No controller lives here yet — this ticket's own AC only requires the use
 * case itself (proven via direct DI injection in its e2e spec, same
 * precedent RAKHAL-344's `CattleService.recordDisposition` established with
 * no controller of its own). RAKHAL-357 (Record Sale flow, frontend) is
 * expected to add the real `POST` route once the wizard needs one.
 */
@Module({
  imports: [
    LoggerModule,
    SalesModule,
    CattleModule,
    FinanceV2ReceivablesModule,
    FinanceV2PaymentsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  providers: [SellAnimalUseCase],
  exports: [SellAnimalUseCase],
})
export class SellAnimalModule {}
