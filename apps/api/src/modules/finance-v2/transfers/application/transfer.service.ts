import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogModule, Prisma, Transfer } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { add, gt, gte, isNegative, toStorage } from 'src/common/money';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateTransferDto } from '../presentation/dto/create-transfer.dto';

/** `LedgerAccount.code` for "Transfer Fee" — seeded by RAKHAL-333's default
 * chart (`default-chart-of-accounts.ts`). Every farm has this row from
 * bootstrap. */
const TRANSFER_FEE_EXPENSE_CODE = '5500';

/**
 * Account-to-account transfer engine (RAKHAL-338, Finance V2 —
 * `FINANCE_V2_DESIGN.md` §4.4, §6). A transfer moves money the farm already
 * has between two of its own `FinancialAccount`s — it never creates revenue
 * or expense, except for an optional fee, which lands on the seeded
 * "Transfer Fee" system `LedgerAccount` (code `5500`).
 *
 * **Journal shape** — one balanced `JournalTransaction` per transfer, up to
 * four `JournalEntry` lines:
 *
 * ```
 * Debit  destination ledger account   amount
 * Credit source ledger account        amount
 * (if feeAmount > 0:)
 * Debit  Transfer Fee Expense         feeAmount
 * Credit source ledger account        feeAmount
 * ```
 *
 * Each pair (the transfer itself, and the fee) is independently balanced,
 * so the whole posting balances too — `SUM(debit) === SUM(credit)` holds
 * for all four lines together, enforced by `JournalService.postJournal`'s
 * `assertBalanced` before any DB write. This produces exactly the design
 * doc's worked example: a ৳10,000 transfer bKash→Bank with a ৳100 fee
 * leaves Bank +10,000 (one debit line), bKash −10,100 (two credit lines,
 * 10,000 + 100, against the *same* ledger account — nothing in the journal
 * model forbids two lines against one account in one transaction), Transfer
 * Fee Expense +100.
 */
@Injectable()
export class TransferService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly balanceService: BalanceService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TransferService.name);
  }

  /**
   * Creates the `Transfer` row and posts its journal entries in one
   * transaction. Rejects: same source/destination account, either account
   * archived, a non-positive amount, a negative fee, or a source balance
   * insufficient to cover `amount + feeAmount`.
   */
  async createTransfer(
    farmId: string,
    userId: string,
    dto: CreateTransferDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Transfer> {
    if (dto.fromFinancialAccountId === dto.toFinancialAccountId) {
      throw new BadRequestException(
        'fromFinancialAccountId and toFinancialAccountId must differ — a transfer cannot target the same account',
      );
    }

    const amount = toStorage(dto.amount);
    if (!gt(amount, 0)) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }
    const feeAmount = toStorage(dto.feeAmount ?? 0);
    if (isNegative(feeAmount)) {
      throw new BadRequestException('Transfer fee cannot be negative');
    }

    // Both accounts must exist for this farm and be active before anything
    // else is checked — same guard `PaymentService.recordWithClient` uses.
    await this.financialAccountService.assertAccountActive(
      farmId,
      dto.fromFinancialAccountId,
    );
    await this.financialAccountService.assertAccountActive(
      farmId,
      dto.toFinancialAccountId,
    );

    const requiredFromSource = add(amount, feeAmount);
    const sourceBalance = await this.balanceService.getAccountBalance(
      farmId,
      dto.fromFinancialAccountId,
    );
    if (!gte(sourceBalance.balance, requiredFromSource)) {
      throw new BadRequestException(
        'Source account balance is insufficient to cover this transfer (amount + fee)',
      );
    }

    const run = (client: Prisma.TransactionClient) =>
      this.createWithClient(client, farmId, userId, dto, amount, feeAmount);
    const transfer = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves. Transfer is
    // one of this ticket's own named "sensitive" actions (owner-only
    // permission, `FINANCE_V2_DESIGN.md` §4.2/§6) — tagged accordingly so a
    // future Activity Log filter/UI can surface it distinctly. `AuditService`
    // is deliberately not also called here: its `AuditAction` enum
    // (`prisma/schemas/audit/audit-enums.prisma`, a hot shared file outside
    // this ticket's Lane) is a closed auth/billing/admin set with no generic
    // farm-money-movement member — same precedent `AnimalHoldService`
    // documents for the identical situation. Flagged as follow-up debt
    // (schema migration to add real `AuditAction` values for Finance V2's
    // owner-only actions) rather than worked around here.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Account Transfer',
      actionDetails: `Transfer ৳${transfer.amount.toString()}${gt(feeAmount, 0) ? ` + ৳${feeAmount.toString()} fee` : ''} between financial accounts.`,
      actorId: userId,
      financialImpact: Number(transfer.amount),
      taggedValues: [{ key: 'sensitive', value: 'owner-only' }],
    });

    return transfer;
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreateTransferDto,
    amount: Prisma.Decimal,
    feeAmount: Prisma.Decimal,
  ): Promise<Transfer> {
    const [fromAccount, toAccount] = await Promise.all([
      client.financialAccount.findFirst({
        where: { id: dto.fromFinancialAccountId, farmId },
        select: { id: true, ledgerAccountId: true },
      }),
      client.financialAccount.findFirst({
        where: { id: dto.toFinancialAccountId, farmId },
        select: { id: true, ledgerAccountId: true },
      }),
    ]);
    if (!fromAccount) {
      throw new NotFoundException('Source financial account not found');
    }
    if (!toAccount) {
      throw new NotFoundException('Destination financial account not found');
    }

    const transfer = await client.transfer.create({
      data: {
        farmId,
        fromFinancialAccountId: fromAccount.id,
        toFinancialAccountId: toAccount.id,
        amount,
        feeAmount,
        transactionDate: new Date(dto.transactionDate),
        notes: dto.notes,
        createdById: userId,
      },
    });

    const entries = [
      { ledgerAccountId: toAccount.ledgerAccountId, debit: amount },
      { ledgerAccountId: fromAccount.ledgerAccountId, credit: amount },
    ];

    if (gt(feeAmount, 0)) {
      const feeAccount = await this.ledgerAccountService.findByCode(
        farmId,
        TRANSFER_FEE_EXPENSE_CODE,
      );
      if (!feeAccount) {
        // Should never happen for a farm bootstrapped via FarmService.create
        // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
        throw new BadRequestException(
          'Transfer Fee Expense ledger account is not seeded for this farm',
        );
      }
      entries.push(
        { ledgerAccountId: feeAccount.id, debit: feeAmount },
        { ledgerAccountId: fromAccount.ledgerAccountId, credit: feeAmount },
      );
    }

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'FINANCE_TRANSFER',
        sourceId: transfer.id,
        transactionDate: transfer.transactionDate,
        description: gt(feeAmount, 0)
          ? `Transfer with ${feeAmount.toString()} fee`
          : 'Transfer',
        idempotencyKey: `finance-transfer:${transfer.id}`,
        createdById: userId,
        entries,
      },
      client,
    );

    this.log.info('Transfer recorded', {
      farmId,
      transferId: transfer.id,
      fromFinancialAccountId: fromAccount.id,
      toFinancialAccountId: toAccount.id,
      amount: amount.toString(),
      feeAmount: feeAmount.toString(),
    });

    return transfer;
  }

  async findOne(farmId: string, id: string): Promise<Transfer> {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, farmId },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  async findAll(farmId: string): Promise<Transfer[]> {
    return this.prisma.transfer.findMany({
      where: { farmId },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    });
  }
}
