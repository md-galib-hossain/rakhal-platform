import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  BankAccountDetail,
  FinancialAccount,
  FinancialAccountType,
  LedgerAccountCategory,
  MfsAccountDetail,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { isZero, toStorage } from 'src/common/money';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateFinancialAccountDto } from '../presentation/dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from '../presentation/dto/update-financial-account.dto';

export type FinancialAccountWithDetail = FinancialAccount & {
  bankDetail: BankAccountDetail | null;
  mfsDetail: MfsAccountDetail | null;
};

/** `LedgerAccount.code` for "Opening Balance Equity" — seeded by RAKHAL-333's default chart
 * (`default-chart-of-accounts.ts`). Every farm has this row from bootstrap. */
const OPENING_BALANCE_EQUITY_CODE = '3000';

/**
 * Farm-custom `LedgerAccount` codes for individually named Cash/Bank/MFS accounts start
 * here (RD-061 fix, 2026-08-17). The original range (`1300`, matching
 * `default-chart-of-accounts.ts`'s own "1300-1900 asset range" doc comment) had no upper
 * bound on the counter — a farm with enough custom accounts eventually walked the counter
 * straight into the seeded system chart's own `2000`/`3000`/`4000+`/`5000+` codes
 * (`default-chart-of-accounts.ts`), permanently 500ing every subsequent
 * `POST /finance/accounts` on that farm (a Postgres unique-constraint violation on
 * `(farmId, code)`, which rolls back the same transaction that incremented the counter —
 * so the counter never advances past the colliding value and every retry fails identically).
 * `9000` is a dedicated range far above any plausible future system-chart addition
 * (system codes today top out at `5600`), so a collision can no longer happen by walking
 * into seeded territory — the only way to hit trouble now is truly exhausting the range,
 * which `CUSTOM_LEDGER_CODE_MAX` below turns into a loud, clear error instead of a silent
 * collision. Pre-existing per-farm counters already advanced into the old 1300-1999 range
 * were bumped forward by the one-off `prisma/fix-custom-ledger-code-counters.ts` script so
 * their *next* allocation lands at `9000`, not `2000` — already-created `LedgerAccount` rows
 * in 1300-1999 are left as-is, they don't collide with anything.
 *
 * **`_MAX` widened 9999 → 9999999 (no ticket #, 2026-08-28):** the counter only ever
 * increments, it is never reclaimed when a `FinancialAccount` row is deleted — so on a
 * long-lived shared dev DB, months of e2e runs each burning a code (most never cleaned up
 * by their spec's `afterAll`) walked the demo farm's counter to exactly `9999`, 409ing
 * every subsequent `POST /finance/accounts`. A cleanup script deleting the orphaned rows
 * does not fix this — the counter doesn't look at existing rows, so deleting them can't
 * free codes back up. Widening the ceiling is the only real fix; the new range is ~10,000x
 * the old one, which should outlast any realistic leak rate for years.
 */
const CUSTOM_LEDGER_CODE_START = 9000;

/** Upper bound of the dedicated custom-account code range. Exceeding it throws
 * (`nextCustomLedgerCode` below) rather than silently colliding with whatever code comes
 * next — see the doc comment on `CUSTOM_LEDGER_CODE_START`. */
const CUSTOM_LEDGER_CODE_MAX = 9999999;

const DETAIL_INCLUDE = { bankDetail: true, mfsDetail: true } as const;

/**
 * Farmer-facing money containers (RAKHAL-335, Finance V2 —
 * `FINANCE_V2_DESIGN.md` §3, §4.4). Every named Cash/Bank/MFS account a farm
 * owns gets its own `FinancialAccount` row, linked one-to-one to a **new,
 * farm-custom `LedgerAccount`** (not the shared system Cash/Bank/MFS rows
 * RAKHAL-333 seeds) so a per-account balance can later be derived purely by
 * summing that account's own `JournalEntry` rows (RAKHAL-336) — two named
 * bank accounts must never share one ledger account or their balances could
 * never be told apart.
 *
 * **No `balance` column exists on `FinancialAccount`.** A non-zero opening
 * balance is realized only as a journal posting through `JournalService`
 * (RAKHAL-334) — this account's ledger account debited, Opening Balance
 * Equity credited — inside the same `$transaction` as the account's own
 * creation, never as a direct field assignment.
 */
@Injectable()
export class FinancialAccountService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FinancialAccountService.name);
  }

  /**
   * Creates the `FinancialAccount` + its type-specific detail row (Bank or
   * MFS; CASH has none) + an opening-balance journal posting (if supplied and
   * non-zero) in one transaction. Accepts an optional `Prisma.TransactionClient`
   * so a future caller (e.g. a farm-bootstrap flow) can fold this into its own
   * transaction — same Unit-of-Work seam as `adjustStock`/`postJournal`.
   */
  async createAccount(
    farmId: string,
    userId: string,
    dto: CreateFinancialAccountDto,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialAccountWithDetail> {
    const run = (client: Prisma.TransactionClient) =>
      this.createWithClient(client, farmId, userId, dto);

    // RAKHAL-353: same standalone-vs-nested reasoning as
    // `PaymentService.recordPayment` — only the top-level call (today,
    // always `POST /finance/accounts`; no caller supplies its own `tx` yet)
    // logs here.
    if (!tx) {
      const account = await this.prisma.$transaction((t) => run(t));
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle: 'Financial Account Created',
        actionDetails: `${account.type} account "${account.name}" created${dto.openingBalance ? ` with ৳${dto.openingBalance} opening balance` : ''}.`,
        actorId: userId,
      });
      return account;
    }
    return run(tx);
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreateFinancialAccountDto,
  ): Promise<FinancialAccountWithDetail> {
    if (dto.type === FinancialAccountType.BANK && !dto.bankDetail) {
      throw new BadRequestException(
        'bankDetail is required for a BANK account',
      );
    }
    if (dto.type === FinancialAccountType.MFS && !dto.mfsDetail) {
      throw new BadRequestException('mfsDetail is required for an MFS account');
    }

    const code = await this.nextCustomLedgerCode(client, farmId);
    const ledgerAccount = await client.ledgerAccount.create({
      data: {
        farmId,
        category: LedgerAccountCategory.ASSET,
        code,
        name: dto.name,
        isSystem: false,
      },
    });

    const account = await client.financialAccount.create({
      data: {
        farmId,
        name: dto.name,
        type: dto.type,
        ledgerAccountId: ledgerAccount.id,
        currency: dto.currency ?? 'BDT',
        createdById: userId,
      },
    });

    let bankDetail: BankAccountDetail | null = null;
    let mfsDetail: MfsAccountDetail | null = null;

    if (dto.type === FinancialAccountType.BANK && dto.bankDetail) {
      bankDetail = await client.bankAccountDetail.create({
        data: {
          financialAccountId: account.id,
          bankName: dto.bankDetail.bankName,
          accountNumber: dto.bankDetail.accountNumber,
          branch: dto.bankDetail.branch,
        },
      });
    } else if (dto.type === FinancialAccountType.MFS && dto.mfsDetail) {
      mfsDetail = await client.mfsAccountDetail.create({
        data: {
          financialAccountId: account.id,
          provider: dto.mfsDetail.provider,
          phoneNumber: dto.mfsDetail.phoneNumber,
          accountType: dto.mfsDetail.accountType,
        },
      });
    }

    if (dto.openingBalance !== undefined && !isZero(dto.openingBalance)) {
      const openingBalance = toStorage(dto.openingBalance);
      let equityAccount = await this.ledgerAccountService.findByCode(
        farmId,
        OPENING_BALANCE_EQUITY_CODE,
        client,
      );
      if (!equityAccount) {
        // Farm's chart of accounts (RAKHAL-333) is seeded best-effort at
        // bootstrap (`FarmService.create`) and can be missing for a farm
        // created before that seeding existed, or if the best-effort seed
        // hiccuped. Self-heal here rather than fail the whole request —
        // seeding is idempotent (`skipDuplicates`), so this is safe to
        // call even if some rows already exist. Must re-read via the same
        // `client` (the open transaction) — reading via the service's bare
        // `this.prisma` connection instead would miss this uncommitted
        // write until the transaction commits.
        await this.ledgerAccountService.seedDefaultChart(farmId, client);
        equityAccount = await this.ledgerAccountService.findByCode(
          farmId,
          OPENING_BALANCE_EQUITY_CODE,
          client,
        );
      }
      if (!equityAccount) {
        throw new BadRequestException(
          'Opening Balance Equity ledger account is not seeded for this farm',
        );
      }
      await this.journalService.postJournal(
        {
          farmId,
          sourceType: 'FINANCIAL_ACCOUNT_OPENING_BALANCE',
          sourceId: account.id,
          transactionDate: new Date(),
          description: `Opening balance for ${dto.name}`,
          idempotencyKey: `financial-account-opening-balance:${account.id}`,
          createdById: userId,
          entries: [
            { ledgerAccountId: ledgerAccount.id, debit: openingBalance },
            { ledgerAccountId: equityAccount.id, credit: openingBalance },
          ],
        },
        client,
      );
    }

    this.log.info('Financial account created', {
      farmId,
      financialAccountId: account.id,
      type: account.type,
      ledgerAccountId: ledgerAccount.id,
      openingBalance: dto.openingBalance ?? 0,
    });

    return { ...account, bankDetail, mfsDetail };
  }

  async findAll(
    farmId: string,
    includeArchived = false,
  ): Promise<FinancialAccountWithDetail[]> {
    return this.prisma.financialAccount.findMany({
      where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
      include: DETAIL_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(
    farmId: string,
    id: string,
  ): Promise<FinancialAccountWithDetail> {
    return this.getOrThrow(farmId, id);
  }

  /** Editable fields only — `type`/`ledgerAccountId` are immutable, enforced simply by never
   * accepting them in `UpdateFinancialAccountDto`. Rejects a detail payload that doesn't match
   * the account's own (immutable) type. */
  async updateAccount(
    farmId: string,
    id: string,
    dto: UpdateFinancialAccountDto,
  ): Promise<FinancialAccountWithDetail> {
    const existing = await this.getOrThrow(farmId, id);

    if (dto.bankDetail && existing.type !== FinancialAccountType.BANK) {
      throw new BadRequestException(
        'bankDetail can only be updated on a BANK account',
      );
    }
    if (dto.mfsDetail && existing.type !== FinancialAccountType.MFS) {
      throw new BadRequestException(
        'mfsDetail can only be updated on an MFS account',
      );
    }

    if (dto.name !== undefined) {
      await this.prisma.financialAccount.update({
        where: { id },
        data: { name: dto.name },
      });
    }

    if (dto.bankDetail) {
      await this.prisma.bankAccountDetail.update({
        where: { financialAccountId: id },
        data: {
          bankName: dto.bankDetail.bankName,
          accountNumber: dto.bankDetail.accountNumber,
          branch: dto.bankDetail.branch,
        },
      });
    }

    if (dto.mfsDetail) {
      await this.prisma.mfsAccountDetail.update({
        where: { financialAccountId: id },
        data: {
          provider: dto.mfsDetail.provider,
          phoneNumber: dto.mfsDetail.phoneNumber,
          accountType: dto.mfsDetail.accountType,
        },
      });
    }

    this.log.info('Financial account updated', {
      farmId,
      financialAccountId: id,
    });
    return this.getOrThrow(farmId, id);
  }

  /** Archive-not-delete (`FINANCE_V2_DESIGN.md` §6 invariant: "an account with transactions is
   * never deleted — archive it"). Rejects re-archiving an already-archived account. */
  async archiveAccount(
    farmId: string,
    id: string,
    userId?: string,
  ): Promise<FinancialAccountWithDetail> {
    const existing = await this.getOrThrow(farmId, id);
    if (existing.deletedAt) {
      throw new ConflictException('Financial account is already archived');
    }
    const account = await this.prisma.financialAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: DETAIL_INCLUDE,
    });
    this.log.info('Financial account archived', {
      farmId,
      financialAccountId: id,
    });

    // RAKHAL-353: account archival is one of this ticket's own named
    // "sensitive" actions (irreversible via this route — archive-not-delete
    // per `FINANCE_V2_DESIGN.md` §6, but a real state change on a farmer-
    // facing money container). `userId` is an added optional param (the
    // controller already resolves `@CurrentUserId()`; only the actor
    // attribution on this log entry needed it, no existing caller broke).
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Financial Account Archived',
      actionDetails: `${account.type} account "${account.name}" archived.`,
      actorId: userId ?? null,
      taggedValues: [{ key: 'sensitive', value: 'account-archived' }],
    });
    return account;
  }

  /**
   * Checkable guard for the invariant "an archived account cannot receive new
   * transactions" (`FINANCE_V2_DESIGN.md` §6). Not yet wired into any caller —
   * Payment/Transfer (RAKHAL-337/338) don't exist yet — but exposed here so
   * they can call it once built, per RAKHAL-335's own AC. Throws
   * `NotFoundException` for an unknown/cross-farm id, `BadRequestException`
   * for an archived one.
   */
  async assertAccountActive(farmId: string, id: string): Promise<void> {
    const account = await this.getOrThrow(farmId, id);
    if (account.deletedAt) {
      throw new BadRequestException(
        'This financial account is archived and cannot receive new transactions',
      );
    }
  }

  /** Allocates the next farm-custom `LedgerAccount.code` for a new `FinancialAccount`, gapless
   * and collision-free — same `FarmCounter` upsert-inside-transaction pattern as
   * `FarmService.create`'s farm-code serial and `SaleNumberAllocator` (a rolled-back create
   * releases the number). The upsert is atomic (Postgres row-level lock on the counter row
   * for the life of the transaction), so concurrent calls always serialize onto distinct
   * values — that part was never the bug. RD-061's bug was the missing upper bound: nothing
   * stopped the counter from walking into the seeded system chart's own code range. Throws
   * a clear, loud error if the dedicated range is ever actually exhausted, instead of
   * silently colliding with the next code (see `CUSTOM_LEDGER_CODE_START`/`_MAX` above). */
  private async nextCustomLedgerCode(
    client: Prisma.TransactionClient,
    farmId: string,
  ): Promise<string> {
    const counter = await client.farmCounter.upsert({
      where: { scope: `finance-v2-account:${farmId}` },
      create: {
        scope: `finance-v2-account:${farmId}`,
        value: CUSTOM_LEDGER_CODE_START,
      },
      update: { value: { increment: 1 } },
    });
    if (counter.value > CUSTOM_LEDGER_CODE_MAX) {
      throw new ConflictException(
        `Custom ledger account code space (${CUSTOM_LEDGER_CODE_START}-${CUSTOM_LEDGER_CODE_MAX}) is exhausted for this farm. Contact support.`,
      );
    }
    return String(counter.value);
  }

  private async getOrThrow(
    farmId: string,
    id: string,
  ): Promise<FinancialAccountWithDetail> {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, farmId },
      include: DETAIL_INCLUDE,
    });
    if (!account) {
      this.log.warn('Financial account not found', {
        financialAccountId: id,
        farmId,
      });
      throw new NotFoundException('Financial account not found');
    }
    return account;
  }
}
