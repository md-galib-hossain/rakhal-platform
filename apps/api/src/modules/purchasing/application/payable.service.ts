import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Payable, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, gte, isZero, subtract, toStorage } from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { PayableStatus } from '../domain/payable-status';
import { ListPayablesQueryDto } from '../presentation/dto/list-payables-query.dto';

export type PayableWithDerived = Payable & {
  outstanding: string;
  status: PayableStatus;
};

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

/**
 * Payable engine (RAKHAL-348, Purchasing — `FINANCE_V2_DESIGN.md` §4.3, §4.6,
 * §5.1). Money the farm owes a supplier for a `Purchase` or `Expense`
 * (RAKHAL-348) that wasn't fully paid at creation. **Mirrors
 * `ReceivableService`** (`finance-v2/receivables/application/
 * receivable.service.ts`, RAKHAL-340) line for line — same derived-status
 * discipline, same reasoning, on the liability side of the books.
 *
 * **Outstanding and status are always computed from `PaymentAllocation`
 * rows, never stored** — the same core decision `Receivable` makes. `Payable`
 * carries only `totalAmount` (a snapshot at creation) plus
 * `dueDate`/`closedAt` bookkeeping fields; every read here re-derives
 * `outstanding = totalAmount - SUM(PaymentAllocation.amount WHERE
 * payableId = this)` and the four-state status
 * (`UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`) from that same sum.
 *
 * **Gap closed by RAKHAL-349**: `assertWithinOutstanding` (mirroring
 * `ReceivableService`'s own method exactly) is now called by
 * `PaymentService.allocatePayment` for `payableId` lines, the same guard
 * `ReceivableService` already had for `receivableId` lines (RAKHAL-340) —
 * a `payableId` allocation is bounded by this payable's real remaining
 * outstanding balance across all its payments, not just one payment's own
 * `amount`.
 */
@Injectable()
export class PayableService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PayableService.name);
  }

  /**
   * Creates the `Payable` row for a `Purchase`/`Expense` that wasn't fully
   * paid at creation. Called by `PurchaseService.createPurchase`/
   * `ExpenseService.recordExpense` as a later step of their own
   * `$transaction`. Exactly one of `purchaseId`/`expenseId` must be set —
   * enforced here (mirrors `Payable`'s own schema doc comment).
   */
  async createPayable(
    farmId: string,
    params: {
      purchaseId?: string | null;
      expenseId?: string | null;
      supplierId?: string | null;
      totalAmount: Prisma.Decimal.Value;
      dueDate?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<Payable> {
    const client = tx ?? this.prisma;
    const hasPurchase = !!params.purchaseId;
    const hasExpense = !!params.expenseId;
    if (hasPurchase === hasExpense) {
      throw new BadRequestException(
        'A payable must be raised for exactly one of purchaseId or expenseId',
      );
    }

    const amount = toStorage(params.totalAmount);
    if (!gt(amount, 0)) {
      throw new BadRequestException(
        'Payable totalAmount must be greater than zero',
      );
    }

    const payable = await client.payable.create({
      data: {
        farmId,
        purchaseId: params.purchaseId ?? null,
        expenseId: params.expenseId ?? null,
        supplierId: params.supplierId ?? null,
        totalAmount: amount,
        dueDate: params.dueDate ?? null,
      },
    });

    this.log.info('Payable created', {
      farmId,
      payableId: payable.id,
      purchaseId: params.purchaseId ?? null,
      expenseId: params.expenseId ?? null,
      totalAmount: amount.toString(),
    });

    return payable;
  }

  /**
   * `totalAmount - SUM(PaymentAllocation.amount WHERE payableId = id)`.
   * Decimal-safe throughout (`src/common/money`). Throws if the payable
   * doesn't exist or belongs to another farm.
   */
  async getOutstanding(
    farmId: string,
    payableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const { outstanding } = await this.getFigures(farmId, payableId, tx);
    return outstanding;
  }

  /**
   * Derives the four-state status per `FINANCE_V2_DESIGN.md` §4.6:
   * `allocated == 0 -> UNPAID`, `0 < allocated < total -> PARTIALLY_PAID`,
   * `allocated >= total -> PAID`; if `dueDate` has passed and the payable is
   * not fully paid, `OVERDUE` takes priority over `UNPAID`/`PARTIALLY_PAID`.
   */
  async getStatus(
    farmId: string,
    payableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableStatus> {
    const { payable, allocated, outstanding } = await this.getFigures(
      farmId,
      payableId,
      tx,
    );
    return this.deriveStatus(payable, allocated, outstanding);
  }

  /**
   * Throws `BadRequestException` if `amount` would push this payable's
   * allocated total past its `totalAmount`. Ready for `PaymentService.
   * allocatePayment` to call for `payableId` lines, once wired (see this
   * class's own doc comment for the current gap).
   */
  async assertWithinOutstanding(
    farmId: string,
    payableId: string,
    amount: Prisma.Decimal.Value,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const outstanding = await this.getOutstanding(farmId, payableId, tx);
    if (gt(amount, outstanding)) {
      throw new BadRequestException(
        'Allocation exceeds the payable outstanding amount — a payable cannot be over-allocated',
      );
    }
  }

  /**
   * Marks `closedAt` once a payable's outstanding reaches zero. Bookkeeping
   * only — `PAID` status is always re-derived from allocations regardless of
   * this field. Idempotent: a no-op if already closed or still outstanding.
   */
  async closeIfSettled(
    farmId: string,
    payableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const { payable, outstanding } = await this.getFigures(
      farmId,
      payableId,
      tx,
    );
    if (payable.closedAt || !isZero(outstanding)) {
      return;
    }
    await client.payable.update({
      where: { id: payableId },
      data: { closedAt: new Date() },
    });
  }

  async findOne(
    farmId: string,
    payableId: string,
  ): Promise<PayableWithDerived> {
    const { payable, allocated, outstanding } = await this.getFigures(
      farmId,
      payableId,
    );
    const status = this.deriveStatus(payable, allocated, outstanding);
    return { ...payable, outstanding: outstanding.toString(), status };
  }

  /**
   * Cursor-paginated list (`src/common/pagination` convention). Each item
   * carries its computed `outstanding`/`status`. Mirrors
   * `ReceivableService.listReceivables` exactly.
   */
  async listPayables(
    farmId: string,
    query: ListPayablesQueryDto,
  ): Promise<CursorPage<PayableWithDerived>> {
    // A voided purchase/expense closes its payable (`VoidDocumentUseCase`) but the row stays, so
    // hide it: otherwise a cancelled bill keeps showing as owed/overdue.
    const where: Prisma.PayableWhereInput = {
      farmId,
      AND: [
        {
          OR: [
            { purchaseId: null },
            { purchase: { status: { not: 'VOIDED' } } },
          ],
        },
        { OR: [{ expenseId: null }, { expense: { voidedAt: null } }] },
      ],
    };
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.dueBefore || query.dueAfter) {
      where.dueDate = {
        ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
        ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
      };
    }

    const rows = await this.prisma.payable.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    if (page.items.length === 0) {
      return { items: [], meta: page.meta };
    }

    const sums = await this.prisma.paymentAllocation.groupBy({
      by: ['payableId'],
      where: { payableId: { in: page.items.map((p) => p.id) } },
      _sum: { amount: true },
    });
    const allocatedById = new Map(
      sums.map((s) => [s.payableId as string, s._sum.amount ?? 0]),
    );

    const items = page.items.map((payable) => {
      const allocated = allocatedById.get(payable.id) ?? 0;
      const outstanding = this.computeOutstanding(payable, allocated);
      const status = this.deriveStatus(payable, allocated, outstanding);
      return { ...payable, outstanding: outstanding.toString(), status };
    });

    return { items, meta: page.meta };
  }

  private async getFigures(
    farmId: string,
    payableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    payable: Payable;
    allocated: Prisma.Decimal;
    outstanding: Prisma.Decimal;
  }> {
    const client: PrismaClientLike = tx ?? this.prisma;
    const payable = await client.payable.findFirst({
      where: { id: payableId, farmId },
    });
    if (!payable) {
      throw new NotFoundException('Payable not found');
    }

    const agg = await client.paymentAllocation.aggregate({
      where: { payableId: payable.id },
      _sum: { amount: true },
    });
    const allocated = agg._sum.amount ?? 0;
    const outstanding = this.computeOutstanding(payable, allocated);

    return { payable, allocated: toStorage(allocated), outstanding };
  }

  private computeOutstanding(
    payable: Payable,
    allocated: Prisma.Decimal.Value,
  ): Prisma.Decimal {
    const raw = subtract(payable.totalAmount, allocated);
    // Clamp defensively — outstanding should never go negative (proper
    // over-allocation rejection lives with the caller — see this class's
    // own doc comment on the current `PaymentService.allocatePayment` gap),
    // but a stale/racy read should never surface a negative number.
    return raw.isNegative() ? toStorage(0) : toStorage(raw);
  }

  private deriveStatus(
    payable: Payable,
    allocated: Prisma.Decimal.Value,
    outstanding: Prisma.Decimal.Value,
  ): PayableStatus {
    let status: PayableStatus;
    if (isZero(allocated)) {
      status = PayableStatus.UNPAID;
    } else if (gte(allocated, payable.totalAmount)) {
      status = PayableStatus.PAID;
    } else {
      status = PayableStatus.PARTIALLY_PAID;
    }

    if (
      status !== PayableStatus.PAID &&
      payable.dueDate &&
      payable.dueDate.getTime() < Date.now() &&
      !isZero(outstanding)
    ) {
      status = PayableStatus.OVERDUE;
    }

    return status;
  }
}
