import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { FinanceV2AccountsModule } from 'src/modules/finance-v2/accounts/finance-v2-accounts.module';
import { AgingService } from './application/aging.service';
import { TransactionFeedService } from './application/transaction-feed.service';
import { PeriodSummaryService } from './application/period-summary.service';
import { ReceivableAgingController } from './presentation/controllers/receivable-aging.controller';
import { PayableAgingController } from './presentation/controllers/payable-aging.controller';
import { TransactionController } from './presentation/controllers/transaction.controller';
import { SummaryController } from './presentation/controllers/summary.controller';

/**
 * `business-reporting` (RAKHAL-369, MILESTONE 22, `BUSINESS_IA_PRD.md` §9.3).
 * A new top-level **read-only leaf module** — sits above Sales, Purchasing
 * and Finance V2, may import any of them, and **nothing may import it**
 * (enforced by `test/architecture.spec.ts`'s new RAKHAL-369 case).
 *
 * Exists because `getReceivablePayablePosition` (`finance-v2/accounts/
 * application/balance.service.ts`) cannot legitimately compute payable
 * aging itself — reading `Payable`/`PaymentAllocation` from inside
 * `finance-v2/**` would create a `Finance → Purchasing` edge, the exact
 * dependency direction ADR-022 forbids and RAKHAL-353's architecture test
 * already fails the build on. Six otherwise-homeless reporting endpoints
 * (this ticket's two aging routes, plus RAKHAL-370/371/374/375/379's own)
 * all land here instead, in one place, with zero test exemptions.
 *
 * Currently reads Postgres directly via `PrismaService` (raw SQL aggregates,
 * `AgingService`'s own doc comment) rather than importing
 * `FinanceV2ReceivablesModule`/`PurchasingModule` — no cross-module service
 * call exists yet for this ticket's narrow scope. A later ticket that needs
 * a real service call (not just a read query) is exactly the case this
 * module was built to accept without inverting anything.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    FinanceV2AccountsModule,
  ],
  controllers: [
    ReceivableAgingController,
    PayableAgingController,
    TransactionController,
    SummaryController,
  ],
  providers: [AgingService, TransactionFeedService, PeriodSummaryService],
  exports: [AgingService, TransactionFeedService, PeriodSummaryService],
})
export class BusinessReportingModule {}
