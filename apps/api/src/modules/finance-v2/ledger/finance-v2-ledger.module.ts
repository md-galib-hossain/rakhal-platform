import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { LedgerAccountService } from './application/ledger-account.service';
import { JournalService } from './application/journal.service';

/**
 * Finance V2 ledger foundation (RAKHAL-333/334/…, `FINANCE_V2_DESIGN.md`
 * §4.4-§4.5, MILESTONE 21 Phase 1). `@Global()` + exported so `FarmService`
 * (farm bootstrap), `prisma/seed.ts`-driven demo-farm setup, and every later
 * money-changing use case (Sale, Payment, Transfer, ...) can inject
 * `LedgerAccountService`/`JournalService` without `FarmModule`/their own
 * module needing to import this module directly — mirrors `OutboxModule`'s
 * own global registration (RAKHAL-332), the same class of cross-cutting
 * primitive.
 *
 * The chart-of-accounts service (RAKHAL-333) and the journal engine
 * (RAKHAL-334, `JournalService.postJournal`/`reverseJournal`) live here.
 * `FinancialAccount` (RAKHAL-335) and balance projection (RAKHAL-336) land
 * in sibling `finance-v2/**` submodules as their own tickets complete — this
 * module is deliberately not renamed to something broader ahead of that
 * work.
 */
@Global()
@Module({
  imports: [LoggerModule, PrismaModule],
  providers: [LedgerAccountService, JournalService],
  exports: [LedgerAccountService, JournalService],
})
export class FinanceV2LedgerModule {}
