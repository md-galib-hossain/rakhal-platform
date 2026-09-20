import { Injectable } from '@nestjs/common';
import { LedgerAccount, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../domain/default-chart-of-accounts';

/**
 * Per-farm chart of accounts (RAKHAL-333, Finance V2 — `FINANCE_V2_DESIGN.md`
 * §4.4). **Internal only** — no controller in this module exposes this
 * service or `LedgerAccount` rows; the chart of accounts is never
 * farmer-facing (farmers see `FinancialAccount`, RAKHAL-335). Consumed by:
 *  - `FarmService.create` (`src/modules/farm/application/services/farm.service.ts`)
 *    — seeds the chart for every real farm on bootstrap.
 *  - `prisma/seed.ts` — seeds the chart for the demo farm(s).
 *  - The journal engine (RAKHAL-334, not yet built) — resolves a
 *    `LedgerAccount` by `(farmId, code)` to post a `JournalEntry` against.
 */
@Injectable()
export class LedgerAccountService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(LedgerAccountService.name);
  }

  /**
   * Seed the default system chart of accounts for one farm. Idempotent
   * (`skipDuplicates` against the `@@unique([farmId, code])` constraint) —
   * safe to call more than once for the same farm, e.g. a re-run seed
   * script or a retried bootstrap step.
   *
   * Accepts an optional `Prisma.TransactionClient` so a caller that already
   * owns a `$transaction` (e.g. a future farm-bootstrap rewrite) can include
   * this write inside it — same Unit-of-Work seam `adjustStock` gained in
   * RAKHAL-341. `FarmService.create` today calls this without one (seeding
   * happens best-effort, after the farm's own transaction commits, mirroring
   * that method's existing default-breeds/trial-provisioning steps — a
   * seeding hiccup must never block farm creation).
   */
  async seedDefaultChart(
    farmId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const result = await client.ledgerAccount.createMany({
      data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
        farmId,
        category: account.category,
        code: account.code,
        name: account.name,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
    this.log.info('Default chart of accounts seeded', {
      farmId,
      created: result.count,
    });
  }

  /** Every ledger account for a farm, ordered by code. Internal use only. */
  async findAll(farmId: string): Promise<LedgerAccount[]> {
    return this.prisma.ledgerAccount.findMany({
      where: { farmId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * One ledger account by its (farmId, code) — the journal engine's lookup.
   * Accepts an optional `Prisma.TransactionClient` so a caller that just
   * wrote (e.g. `seedDefaultChart`) inside an open transaction can read its
   * own uncommitted write back — reading via the bare `this.prisma`
   * connection instead would see pre-commit state and miss it.
   */
  async findByCode(
    farmId: string,
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerAccount | null> {
    const client = tx ?? this.prisma;
    return client.ledgerAccount.findUnique({
      where: { farmId_code: { farmId, code } },
    });
  }
}
