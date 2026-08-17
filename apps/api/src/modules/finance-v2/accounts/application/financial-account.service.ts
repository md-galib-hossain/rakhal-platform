import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
import { CreateFinancialAccountDto } from '../presentation/dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from '../presentation/dto/update-financial-account.dto';

export type FinancialAccountWithDetail = FinancialAccount & {
  bankDetail: BankAccountDetail | null;
  mfsDetail: MfsAccountDetail | null;
};

/** `LedgerAccount.code` for "Opening Balance Equity" — seeded by RAKHAL-333's default chart
 * (`default-chart-of-accounts.ts`). Every farm has this row from bootstrap. */
const OPENING_BALANCE_EQUITY_CODE = '3000';

/** Farm-custom `LedgerAccount` codes for individually named Cash/Bank/MFS accounts start
 * here — the 1300-1900 asset range `default-chart-of-accounts.ts`'s own doc comment
 * reserves for exactly this purpose, so a per-account sub-ledger can never collide with the
 * 1000/1010/1020/1100/1200 system rows. */
const CUSTOM_LEDGER_CODE_START = 1300;

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
    return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
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
      const equityAccount = await this.ledgerAccountService.findByCode(
        farmId,
        OPENING_BALANCE_EQUITY_CODE,
      );
      if (!equityAccount) {
        // Should never happen for a farm bootstrapped via FarmService.create
        // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
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
      where: { farmId, ...(includeArchived ? {} : { isActive: true }) },
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
  ): Promise<FinancialAccountWithDetail> {
    const existing = await this.getOrThrow(farmId, id);
    if (!existing.isActive) {
      throw new ConflictException('Financial account is already archived');
    }
    const account = await this.prisma.financialAccount.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() },
      include: DETAIL_INCLUDE,
    });
    this.log.info('Financial account archived', {
      farmId,
      financialAccountId: id,
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
    if (!account.isActive) {
      throw new BadRequestException(
        'This financial account is archived and cannot receive new transactions',
      );
    }
  }

  /** Allocates the next farm-custom `LedgerAccount.code` for a new `FinancialAccount`, gapless
   * and collision-free — same `FarmCounter` upsert-inside-transaction pattern as
   * `FarmService.create`'s farm-code serial (a rolled-back create releases the number). */
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
