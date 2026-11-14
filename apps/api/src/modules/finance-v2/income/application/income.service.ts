import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  IncomeCategory,
  OtherIncome,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, toStorage } from 'src/common/money';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateIncomeCategoryDto } from '../presentation/dto/create-income-category.dto';
import { RecordOtherIncomeDto } from '../presentation/dto/record-other-income.dto';

/** `LedgerAccount.code` for "Other Income" — seeded by RAKHAL-333's default
 * chart (`default-chart-of-accounts.ts`). Every farm has this row from
 * bootstrap. */
const OTHER_INCOME_LEDGER_CODE = '4900';

/**
 * `IncomeCategory` + `OtherIncome` (RAKHAL-350, Finance V2 —
 * `FINANCE_V2_DESIGN.md` §1.3, §5.1). Closes the "Manure and 'Other' do not
 * exist as concepts" gap: before this ticket non-sale revenue (a subsidy, an
 * insurance payout, rent, ...) had no model at all — just a free-text
 * `subType` string on the old `FinanceTransaction`. There is deliberately no
 * `subType` string anywhere in this file.
 *
 * `IncomeCategory` follows the `Unit` catalogue convention (RAKHAL-326):
 * `farmId: null` rows are global system categories seeded once in
 * `prisma/seed.ts`; `farmId`-set rows are one farm's own custom category.
 * See `other-income.prisma`'s own doc comment for the full reasoning versus
 * `LedgerAccount`'s per-farm-seeded convention.
 */
@Injectable()
export class IncomeService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(IncomeService.name);
  }

  /** System categories (`farmId: null`) plus this farm's own custom ones, system-first then
   * alphabetical — the same "global catalogue + farm-custom rows" list shape `UnitService`
   * (RAKHAL-326) returns. */
  async listCategories(farmId: string): Promise<IncomeCategory[]> {
    return this.prisma.incomeCategory.findMany({
      where: { OR: [{ farmId: null }, { farmId }] },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /** Farm-custom category quick-add — always `isSystem: false`; a farm can never create a
   * system row. */
  async createCategory(
    farmId: string,
    dto: CreateIncomeCategoryDto,
  ): Promise<IncomeCategory> {
    const category = await this.prisma.incomeCategory.create({
      data: {
        name: dto.name,
        isSystem: false,
        farmId,
      },
    });
    this.log.info('Income category created', {
      farmId,
      incomeCategoryId: category.id,
    });
    return category;
  }

  /**
   * Creates the `OtherIncome` row and posts its journal entry — debit the
   * target `FinancialAccount`'s own ledger account, credit the shared "Other
   * Income" revenue `LedgerAccount` (code `4900`) — in one transaction.
   * Money must land somewhere immediately (this is direct income, not a
   * receivable), so the target account must be active
   * (`assertAccountActive`) and the category must be visible to this farm
   * (a system row or this farm's own custom row).
   */
  async recordOtherIncome(
    farmId: string,
    userId: string,
    dto: RecordOtherIncomeDto,
    tx?: Prisma.TransactionClient,
  ): Promise<OtherIncome> {
    const run = (client: Prisma.TransactionClient) =>
      this.recordWithClient(client, farmId, userId, dto);
    const otherIncome = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Other Income Recorded',
      actionDetails: `${dto.description} — ৳${otherIncome.amount.toString()}.`,
      actorId: userId,
      financialImpact: Number(otherIncome.amount),
    });

    return otherIncome;
  }

  private async recordWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: RecordOtherIncomeDto,
  ): Promise<OtherIncome> {
    const category = await client.incomeCategory.findFirst({
      where: {
        id: dto.categoryId,
        OR: [{ farmId: null }, { farmId }],
      },
    });
    if (!category) {
      throw new NotFoundException('Income category not found');
    }

    // One account per farm: the caller no longer picks a wallet.
    const financialAccountId =
      await this.financialAccountService.resolveFarmAccountId(
        farmId,
        userId,
        dto.financialAccountId,
        client,
      );
    await this.financialAccountService.assertAccountActive(
      farmId,
      financialAccountId,
    );
    const account = await client.financialAccount.findFirst({
      where: { id: financialAccountId, farmId },
      select: { id: true, ledgerAccountId: true },
    });
    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    const amount = toStorage(dto.amount);
    if (!gt(amount, 0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const otherIncomeLedgerAccount = await this.ledgerAccountService.findByCode(
      farmId,
      OTHER_INCOME_LEDGER_CODE,
    );
    if (!otherIncomeLedgerAccount) {
      // Should never happen for a farm bootstrapped via FarmService.create
      // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
      throw new BadRequestException(
        'Other Income ledger account is not seeded for this farm',
      );
    }

    const otherIncome = await client.otherIncome.create({
      data: {
        farmId,
        categoryId: category.id,
        description: dto.description,
        amount,
        date: new Date(dto.date),
        financialAccountId: account.id,
        createdById: userId,
      },
    });

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'OTHER_INCOME',
        sourceId: otherIncome.id,
        transactionDate: otherIncome.date,
        description: `Other income: ${category.name}`,
        idempotencyKey: `other-income:${otherIncome.id}`,
        createdById: userId,
        entries: [
          { ledgerAccountId: account.ledgerAccountId, debit: amount },
          { ledgerAccountId: otherIncomeLedgerAccount.id, credit: amount },
        ],
      },
      client,
    );

    this.log.info('Other income recorded', {
      farmId,
      otherIncomeId: otherIncome.id,
      categoryId: category.id,
      financialAccountId: account.id,
      amount: amount.toString(),
    });

    return otherIncome;
  }

  async findOne(farmId: string, id: string): Promise<OtherIncome> {
    const otherIncome = await this.prisma.otherIncome.findFirst({
      where: { id, farmId },
    });
    if (!otherIncome) {
      throw new NotFoundException('Other income not found');
    }
    return otherIncome;
  }

  async findAll(farmId: string): Promise<OtherIncome[]> {
    return this.prisma.otherIncome.findMany({
      where: { farmId },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }
}
