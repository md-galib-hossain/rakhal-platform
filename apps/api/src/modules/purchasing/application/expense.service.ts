import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  Expense,
  ExpenseCategory,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { toStorage } from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  JournalService,
  PostJournalLine,
} from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { RecordExpenseDto } from '../presentation/dto/record-expense.dto';
import { ListExpensesQueryDto } from '../presentation/dto/list-expenses-query.dto';
import { assertSupplierBelongsToFarm } from '../domain/assert-supplier-in-farm';
import { derivePayableDueDate } from '../domain/due-date';
import { PayableStatus } from '../domain/payable-status';
import { PayableService } from './payable.service';

/**
 * SQL `where` fragment for `?paymentStatus=` on `GET /purchasing/expenses`
 * (RAKHAL-375) — same shape as `purchase.service.ts`'s
 * `buildPurchasePaymentStatusWhere`, against `Expense`'s own `payable`
 * relation. Kept as a second, file-local copy rather than a shared helper —
 * same "no premature abstraction across two structurally-similar-but-
 * distinct Prisma models" judgment call `sale.service.ts`'s
 * `deriveSalePaymentStatus` doc comment already documents for this exact
 * situation.
 */
function buildExpensePaymentStatusWhere(
  status: PayableStatus,
): Prisma.ExpenseWhereInput {
  const now = new Date();
  const notOverdue: Prisma.ExpenseWhereInput = {
    OR: [
      { payable: { dueDate: null } },
      { payable: { dueDate: { gte: now } } },
    ],
  };

  switch (status) {
    case PayableStatus.PAID:
      return {
        OR: [{ payable: null }, { payable: { closedAt: { not: null } } }],
      };
    case PayableStatus.UNPAID:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { allocations: { none: {} } } },
          notOverdue,
        ],
      };
    case PayableStatus.PARTIALLY_PAID:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { allocations: { some: {} } } },
          notOverdue,
        ],
      };
    case PayableStatus.OVERDUE:
      return {
        AND: [
          { payable: { isNot: null } },
          { payable: { closedAt: null } },
          { payable: { dueDate: { lt: now } } },
        ],
      };
  }
}

/** `LedgerAccount.code` for "Accounts Payable" — seeded by RAKHAL-333's
 * default chart. */
const ACCOUNTS_PAYABLE_CODE = '2000';

/** `LedgerAccount.code` for "Inventory" — same seeding, same code
 * `PurchaseService` debits on a real purchase. RD-084's
 * `recordInventoryConsumption` credits it back down on consumption. */
const INVENTORY_CODE = '1200';

/** `ExpenseCategory` -> seeded `LedgerAccount.code` (RAKHAL-333's default
 * chart, 5xxx range). See `purchase.enums.prisma`'s own doc comment on
 * `ExpenseCategory` for why the original five categories were exactly those
 * five; `OTHER`/`HEALTH` were added later, each with its own doc comment. */
const EXPENSE_CATEGORY_LEDGER_CODE: Record<ExpenseCategory, string> = {
  [ExpenseCategory.SALARY]: '5200',
  [ExpenseCategory.UTILITIES]: '5400',
  [ExpenseCategory.BREEDING]: '5300',
  [ExpenseCategory.TRANSFER_FEE]: '5500',
  [ExpenseCategory.DEPRECIATION]: '5600',
  // RAKHAL-367 (MILESTONE 22) — closes RD-060.
  [ExpenseCategory.OTHER]: '5900',
  // RAKHAL-419 (MILESTONE 24) — treatment-time medicine consumption cost.
  [ExpenseCategory.HEALTH]: '5100',
};

/**
 * Expense engine (RAKHAL-348, Purchasing — `FINANCE_V2_DESIGN.md` §5.1). An
 * `Expense` is consumed immediately — electricity, salary, breeding cost,
 * depreciation, a transfer fee logged by hand — and never becomes inventory,
 * the deliberate opposite of `PurchaseService.createPurchase`
 * (`FINANCE_V2_DESIGN.md`'s own worked example: "a feed purchase increases
 * an asset, an electricity bill is an expense").
 *
 * Posts a balanced journal in the same `$transaction` as the `Expense` row:
 * debits the category's own expense ledger account, and either credits the
 * chosen `FinancialAccount` (paid in full immediately) or credits Accounts
 * Payable + raises a `Payable` (unpaid at creation) — never both, per this
 * ticket's own simpler-than-`Purchase` payment shape (see
 * `RecordExpenseDto`'s own doc comment).
 */
@Injectable()
export class ExpenseService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly payableService: PayableService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ExpenseService.name);
  }

  async recordExpense(
    farmId: string,
    userId: string,
    dto: RecordExpenseDto,
  ): Promise<Expense> {
    const expense = await this.prisma.$transaction((tx) =>
      this.recordWithClient(tx, farmId, userId, dto),
    );

    // RAKHAL-353: see `SellMilkUseCase.execute`'s own comment on this same
    // call — deliberately logged after the transaction resolves.
    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Expense Recorded',
      actionDetails: `${dto.category} expense: ${dto.description} — ৳${expense.amount.toString()}${dto.financialAccountId ? ' (paid immediately)' : ' (unpaid, payable raised)'}.`,
      actorId: userId,
      financialImpact: -Number(expense.amount),
    });

    return expense;
  }

  private async recordWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: RecordExpenseDto,
  ): Promise<Expense> {
    const amount = toStorage(dto.amount);

    if (dto.supplierId) {
      await assertSupplierBelongsToFarm(client, farmId, dto.supplierId);
    }

    let financialAccountLedgerAccountId: string | null = null;
    if (dto.financialAccountId) {
      await this.financialAccountService.assertAccountActive(
        farmId,
        dto.financialAccountId,
      );
      const account = await client.financialAccount.findFirst({
        where: { id: dto.financialAccountId, farmId },
        select: { id: true, ledgerAccountId: true },
      });
      if (!account) {
        throw new NotFoundException('Financial account not found');
      }
      financialAccountLedgerAccountId = account.ledgerAccountId;
    }

    const expense = await client.expense.create({
      data: {
        farmId,
        category: dto.category,
        description: dto.description,
        amount,
        expenseDate: new Date(dto.expenseDate),
        financialAccountId: dto.financialAccountId ?? null,
        supplierId: dto.supplierId ?? null,
        notes: dto.notes ?? null,
        cattleId: dto.cattleId ?? null,
        createdById: userId,
      },
    });

    const expenseAccountCode = EXPENSE_CATEGORY_LEDGER_CODE[dto.category];
    const expenseAccount = await this.ledgerAccountService.findByCodeOrSeed(
      farmId,
      expenseAccountCode,
      client,
    );
    if (!expenseAccount) {
      throw new BadRequestException(
        `Expense ledger account (${expenseAccountCode}) is not seeded for this farm`,
      );
    }

    const entries: PostJournalLine[] = [
      { ledgerAccountId: expenseAccount.id, debit: amount },
    ];

    if (financialAccountLedgerAccountId) {
      entries.push({
        ledgerAccountId: financialAccountLedgerAccountId,
        credit: amount,
      });
    } else {
      const payableAccount = await this.ledgerAccountService.findByCodeOrSeed(
        farmId,
        ACCOUNTS_PAYABLE_CODE,
        client,
      );
      if (!payableAccount) {
        throw new BadRequestException(
          'Accounts Payable ledger account is not seeded for this farm',
        );
      }
      entries.push({ ledgerAccountId: payableAccount.id, credit: amount });
    }

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        transactionDate: expense.expenseDate,
        description: `Expense: ${dto.description}`,
        idempotencyKey: `expense:${expense.id}`,
        createdById: userId,
        entries,
      },
      client,
    );

    if (!financialAccountLedgerAccountId) {
      const dueDate = dto.dueDate
        ? new Date(dto.dueDate)
        : await this.deriveDueDate(client, dto.supplierId, expense.expenseDate);
      await this.payableService.createPayable(
        farmId,
        {
          expenseId: expense.id,
          supplierId: dto.supplierId ?? null,
          totalAmount: amount,
          dueDate,
        },
        client,
      );
    }

    this.log.info('Expense recorded', {
      farmId,
      expenseId: expense.id,
      category: dto.category,
      amount: amount.toString(),
      paidImmediately: !!financialAccountLedgerAccountId,
    });

    return expense;
  }

  /**
   * RD-084: a consumption cost for stock that was already paid for at
   * `PurchaseService.createPurchase` time — Medicine used in treatment,
   * today; Feed consumed outside a linked TMR line, potentially tomorrow.
   * The cash (or payable) already moved once, at purchase; `recordExpense`'s
   * `Dr expense / Cr cash-or-payable` would move it a *second* time for the
   * same rupees while never shrinking the Inventory asset that purchase
   * grew. This posts the correct entry instead — `Dr <category expense> /
   * Cr Inventory(1200)` — a same-farm balance-sheet transfer, no
   * `FinancialAccount`, no `Payable`, no `supplierId`. Still creates a real
   * `Expense` row so every existing category-HEALTH consumer (dashboard
   * `sumHealthExpense`, per-animal P&L, `reverseExpense` on treatment
   * void/edit) keeps working unchanged — only the journal's credit leg
   * differs from `recordExpense`'s.
   */
  async recordInventoryConsumption(
    farmId: string,
    userId: string,
    dto: {
      category: ExpenseCategory;
      description: string;
      amount: number;
      expenseDate: string;
      cattleId?: string;
    },
  ): Promise<Expense> {
    const expense = await this.prisma.$transaction((tx) =>
      this.recordInventoryConsumptionWithClient(tx, farmId, userId, dto),
    );

    await this.activityLog.record({
      farmId,
      module: ActivityLogModule.FINANCE,
      eventTitle: 'Expense Recorded',
      actionDetails: `${dto.category} expense: ${dto.description} — ৳${expense.amount.toString()} (inventory consumption, no cash movement).`,
      actorId: userId,
      financialImpact: 0,
    });

    return expense;
  }

  private async recordInventoryConsumptionWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: {
      category: ExpenseCategory;
      description: string;
      amount: number;
      expenseDate: string;
      cattleId?: string;
    },
  ): Promise<Expense> {
    const amount = toStorage(dto.amount);

    const expense = await client.expense.create({
      data: {
        farmId,
        category: dto.category,
        description: dto.description,
        amount,
        expenseDate: new Date(dto.expenseDate),
        financialAccountId: null,
        supplierId: null,
        notes: null,
        cattleId: dto.cattleId ?? null,
        createdById: userId,
      },
    });

    const expenseAccountCode = EXPENSE_CATEGORY_LEDGER_CODE[dto.category];
    const expenseAccount = await this.ledgerAccountService.findByCodeOrSeed(
      farmId,
      expenseAccountCode,
      client,
    );
    if (!expenseAccount) {
      throw new BadRequestException(
        `Expense ledger account (${expenseAccountCode}) is not seeded for this farm`,
      );
    }
    const inventoryAccount = await this.ledgerAccountService.findByCodeOrSeed(
      farmId,
      INVENTORY_CODE,
      client,
    );
    if (!inventoryAccount) {
      throw new BadRequestException(
        'Inventory ledger account is not seeded for this farm',
      );
    }

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        transactionDate: expense.expenseDate,
        description: `Expense: ${dto.description}`,
        idempotencyKey: `expense:${expense.id}`,
        createdById: userId,
        entries: [
          { ledgerAccountId: expenseAccount.id, debit: amount },
          { ledgerAccountId: inventoryAccount.id, credit: amount },
        ],
      },
      client,
    );

    this.log.info('Inventory consumption expense recorded', {
      farmId,
      expenseId: expense.id,
      category: dto.category,
      amount: amount.toString(),
    });

    return expense;
  }

  /** RAKHAL-365: mirrors `PurchaseService.deriveDueDate` exactly, on the
   * expense side. */
  private async deriveDueDate(
    client: Prisma.TransactionClient,
    supplierId: string | undefined,
    expenseDate: Date,
  ): Promise<Date | null> {
    if (!supplierId) {
      return null;
    }
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { paymentTermsDays: true },
    });
    return derivePayableDueDate(expenseDate, supplier?.paymentTermsDays);
  }

  async findOne(farmId: string, id: string): Promise<Expense> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, farmId },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  /**
   * `GET /purchasing/expenses` v2 (RAKHAL-375, MILESTONE 22 —
   * `BUSINESS_IA_PRD.md` §5.13). Cursor-paginated + filtered, mirrors
   * `PurchaseService.findAll`'s own shape exactly.
   */
  async findAll(
    farmId: string,
    query: ListExpensesQueryDto,
  ): Promise<CursorPage<Expense>> {
    const where: Prisma.ExpenseWhereInput = {
      farmId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.paymentStatus
        ? buildExpensePaymentStatusWhere(query.paymentStatus)
        : {}),
    };

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    return toCursorPage(rows, query);
  }

  /**
   * RAKHAL-354: reverses the balanced journal posting an expense produced,
   * without deleting the `Expense`/`Payable` rows themselves — same
   * "original stays, a mirror reversal is added" invariant every V2 reversal
   * follows (`JournalService.reverseJournal`'s own doc comment). Added
   * specifically for `ReproductionEditService`'s migrated breeding-cost
   * edit flow (was V1 `FinanceService.voidTransaction`), which voids-and-
   * reposts on every cost-relevant field edit. A no-op (idempotent) if
   * already reversed once for this `expenseId` — same convention
   * `JournalService.reverseJournal` itself already guarantees.
   */
  /**
   * Protocols v2 undo — reverses an inventory-consumption expense (a recorded treatment dose that was a mistake) AND marks
   * the `Expense` row `voidedAt`, so every Finance / cattle / health aggregate that skips voided expenses stops counting it.
   * Idempotent: a second call is a no-op (the journal reversal is idempotency-keyed, `voidedAt` is only set once).
   */
  async voidInventoryConsumption(
    farmId: string,
    expenseId: string,
    userId: string,
  ): Promise<void> {
    await this.reverseExpense(farmId, expenseId, userId);
    await this.prisma.expense.updateMany({
      where: { id: expenseId, farmId, voidedAt: null },
      data: { voidedAt: new Date() },
    });
  }

  async reverseExpense(
    farmId: string,
    expenseId: string,
    userId: string,
  ): Promise<void> {
    const journalTxn = await this.prisma.journalTransaction.findFirst({
      where: { farmId, sourceType: 'EXPENSE', sourceId: expenseId },
      select: { id: true },
    });
    if (!journalTxn) {
      // Nothing was ever posted for this expense (e.g. it predates this
      // ticket, or amount was 0) — nothing to reverse.
      return;
    }
    await this.journalService.reverseJournal({
      farmId,
      journalTransactionId: journalTxn.id,
      createdById: userId,
      idempotencyKey: `expense-reversal:${expenseId}`,
      description: `Reversal of expense ${expenseId}`,
    });
  }
}
