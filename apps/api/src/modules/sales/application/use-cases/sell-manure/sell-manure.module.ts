import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { SalesModule } from 'src/modules/sales/sales.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { RecordManureSaleUseCase } from './record-manure-sale.use-case';

/**
 * `RecordManureSale` use case module (RAKHAL-347). No controller — this ticket's
 * Lane is `application/use-cases/sell-manure/**` only; HTTP wiring is a later,
 * frontend-facing ticket's job (RAKHAL-357). Registered directly in `AppModule` so
 * `RecordManureSaleUseCase` is resolvable by e2e tests via `app.get(...)`, the same
 * way every other Finance V2 module is wired in.
 *
 * Imports `SalesModule` for `SaleService` (document creation),
 * `FinanceV2ReceivablesModule` for `ReceivableService`, and
 * `FinanceV2PaymentsModule` for `PaymentService` — no guard-chain modules
 * (`AuthModule`/`TenantAccessModule`/etc.) since there is no controller here to
 * guard. `PrismaService`/`LedgerAccountService`/`JournalService` resolve via their
 * own `@Global()` modules already imported elsewhere in `AppModule`.
 */
@Module({
  imports: [
    LoggerModule,
    SalesModule,
    FinanceV2ReceivablesModule,
    FinanceV2PaymentsModule,
    // RAKHAL-353: ActivityLogService for the new money-moving log entry.
    ActivityModule,
  ],
  providers: [RecordManureSaleUseCase],
  exports: [RecordManureSaleUseCase],
})
export class SellManureModule {}
