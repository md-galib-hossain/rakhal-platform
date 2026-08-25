import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Receivable } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { gt, gte, isZero, subtract, toStorage } from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ReceivableStatus } from '../domain/receivable-status';
import { ListReceivablesQueryDto } from '../presentation/dto/list-receivables-query.dto';

export type ReceivableWithDerived = Receivable & {
  outstanding: string;
  status: ReceivableStatus;
};

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

/**
 * Receivable engine (RAKHAL-340, Finance V2 — `FINANCE_V2_DESIGN.md` §4.3,
 * §4.6, Phase 3). Money a customer owes the farm for a `Sale`
 * (RAKHAL-339) that wasn't fully paid at creation.
 *
 * **Outstanding and status are always computed from `PaymentAllocation`
 * rows, never stored** — the ticket's core AC. `Receivable` carries only
 * `totalAmount` (a snapshot of `Sale.totalAmount` at creation) plus
 * `dueDate`/`closedAt` bookkeeping fields; every read here re-derives
 * `outstanding = totalAmount - SUM(PaymentAllocation.amount WHERE
 * receivableId = this)` and the four-state status
 * (`UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`) from that same sum, so the
 * two can never drift out of sync the way V1's hand-set
 * `FinanceReceivable.status` (`FULL`/`PARTIAL`, farmer-picked) could.
 *
 * `assertWithinOutstanding` is the seam `PaymentService.allocatePayment`
 * (RAKHAL-337) calls once an allocation targets a real `receivableId` — it
 * closes the gap that ticket's own guard left: RAKHAL-337 could only check
 * an allocation against its *own payment's* `amount` (no `Receivable`
 * existed yet to check against), so a second payment could still
 * over-allocate a receivable that a first payment had already partially
 * settled. This method makes that cross-payment case impossible.
 */
@Injectable()
export class ReceivableService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReceivableService.name);
  }

  /**
   * Creates the `Receivable` row for a `Sale` that wasn't fully paid at
   * creation. Called by the sale-type use cases (RAKHAL-342/345/346/347) as
   * a later step of their own `$transaction`, after `SaleService.createSale`.
   * `totalAmount` should mirror `Sale.totalAmount` exactly (the caller's
   * responsibility — this method does not re-read the `Sale` row itself,
   * keeping it decoupled from the Sales module per `FINANCE_V2_DESIGN.md`
   * §4.2's dependency-direction rule).
   */
  async createReceivable(
    farmId: string,
    saleId: string,
    totalAmount: Prisma.Decimal.Value,
    dueDate?: Date | null,
    tx?: Prisma.TransactionClient,
  ): Promise<Receivable> {
    const client = tx ?? this.prisma;
    const amount = toStorage(totalAmount);
    if (!gt(amount, 0)) {
      throw new BadRequestException(
        'Receivable totalAmount must be greater than zero',
      );
    }

    const receivable = await client.receivable.create({
      data: {
        farmId,
        saleId,
        totalAmount: amount,
        dueDate: dueDate ?? null,
      },
    });

    this.log.info('Receivable created', {
      farmId,
      receivableId: receivable.id,
      saleId,
      totalAmount: amount.toString(),
    });

    return receivable;
  }

  /**
   * `totalAmount - SUM(PaymentAllocation.amount WHERE receivableId = id)`.
   * Decimal-safe throughout (`src/common/money`). Throws if the receivable
   * doesn't exist or belongs to another farm.
   */
  async getOutstanding(
    farmId: string,
    receivableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const { outstanding } = await this.getFigures(farmId, receivableId, tx);
    return outstanding;
  }

  /**
   * Derives the four-state status per `FINANCE_V2_DESIGN.md` §4.6:
   * `allocated == 0 -> UNPAID`, `0 < allocated < total -> PARTIALLY_PAID`,
   * `allocated >= total -> PAID`; if `dueDate` has passed and the receivable
   * is not fully paid, `OVERDUE` takes priority over `UNPAID`/`PARTIALLY_PAID`.
   */
  async getStatus(
    farmId: string,
    receivableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReceivableStatus> {
    const { receivable, allocated, outstanding } = await this.getFigures(
      farmId,
      receivableId,
      tx,
    );
    return this.deriveStatus(receivable, allocated, outstanding);
  }

  /**
   * Throws `BadRequestException` if `amount` would push this receivable's
   * allocated total past its `totalAmount`. Called by
   * `PaymentService.allocatePayment` immediately before persisting each
   * allocation row that carries a `receivableId`, inside the same
   * transaction client, so the check sees allocations already created
   * earlier in the same call.
   */
  async assertWithinOutstanding(
    farmId: string,
    receivableId: string,
    amount: Prisma.Decimal.Value,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const outstanding = await this.getOutstanding(farmId, receivableId, tx);
    if (gt(amount, outstanding)) {
      throw new BadRequestException(
        'Allocation exceeds the receivable outstanding amount — a receivable cannot be over-allocated',
      );
    }
  }

  /**
   * Marks `closedAt` once a receivable's outstanding reaches zero.
   * Bookkeeping only — `PAID` status is always re-derived from allocations
   * regardless of this field (see the model's own doc comment). Idempotent:
   * a no-op if already closed or still outstanding. Called by
   * `PaymentService.allocatePayment` right after creating an allocation
   * against a receivable, inside the same transaction client.
   */
  async closeIfSettled(
    farmId: string,
    receivableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const { receivable, outstanding } = await this.getFigures(
      farmId,
      receivableId,
      tx,
    );
    if (receivable.closedAt || !isZero(outstanding)) {
      return;
    }
    await client.receivable.update({
      where: { id: receivableId },
      data: { closedAt: new Date() },
    });
  }

  async findOne(
    farmId: string,
    receivableId: string,
  ): Promise<ReceivableWithDerived> {
    const { receivable, allocated, outstanding } = await this.getFigures(
      farmId,
      receivableId,
    );
    const status = this.deriveStatus(receivable, allocated, outstanding);
    return { ...receivable, outstanding: outstanding.toString(), status };
  }

  /**
   * Cursor-paginated list (`src/common/pagination` convention —
   * `CursorPaginationQueryDto`, `getCursorArgs`, `toCursorPage`, `orderBy`
   * ending in `id`). Each item carries its computed `outstanding`/`status`.
   * Filtering is DB-level on `customerId`/`dueDate` only — `status` is not
   * filterable since it's derived per-row from `PaymentAllocation` sums, not
   * a column a `WHERE` clause could match against without breaking cursor
   * semantics (a follow-up could add a computed-column filter pass, out of
   * this ticket's scope).
   */
  async listReceivables(
    farmId: string,
    query: ListReceivablesQueryDto,
  ): Promise<CursorPage<ReceivableWithDerived>> {
    const where: Prisma.ReceivableWhereInput = { farmId };
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.dueBefore || query.dueAfter) {
      where.dueDate = {
        ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
        ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
      };
    }

    const rows = await this.prisma.receivable.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    if (page.items.length === 0) {
      return { items: [], meta: page.meta };
    }

    const sums = await this.prisma.paymentAllocation.groupBy({
      by: ['receivableId'],
      where: { receivableId: { in: page.items.map((r) => r.id) } },
      _sum: { amount: true },
    });
    const allocatedById = new Map(
      sums.map((s) => [s.receivableId as string, s._sum.amount ?? 0]),
    );

    const items = page.items.map((receivable) => {
      const allocated = allocatedById.get(receivable.id) ?? 0;
      const outstanding = this.computeOutstanding(receivable, allocated);
      const status = this.deriveStatus(receivable, allocated, outstanding);
      return { ...receivable, outstanding: outstanding.toString(), status };
    });

    return { items, meta: page.meta };
  }

  private async getFigures(
    farmId: string,
    receivableId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    receivable: Receivable;
    allocated: Prisma.Decimal;
    outstanding: Prisma.Decimal;
  }> {
    const client: PrismaClientLike = tx ?? this.prisma;
    const receivable = await client.receivable.findFirst({
      where: { id: receivableId, farmId },
    });
    if (!receivable) {
      throw new NotFoundException('Receivable not found');
    }

    const agg = await client.paymentAllocation.aggregate({
      where: { receivableId: receivable.id },
      _sum: { amount: true },
    });
    const allocated = agg._sum.amount ?? 0;
    const outstanding = this.computeOutstanding(receivable, allocated);

    return { receivable, allocated: toStorage(allocated), outstanding };
  }

  private computeOutstanding(
    receivable: Receivable,
    allocated: Prisma.Decimal.Value,
  ): Prisma.Decimal {
    const raw = subtract(receivable.totalAmount, allocated);
    // Clamp defensively — outstanding should never go negative
    // (over-allocation is rejected before it can happen via
    // `assertWithinOutstanding`), but a stale/racy read should never
    // surface a negative number to a caller.
    return raw.isNegative() ? toStorage(0) : toStorage(raw);
  }

  private deriveStatus(
    receivable: Receivable,
    allocated: Prisma.Decimal.Value,
    outstanding: Prisma.Decimal.Value,
  ): ReceivableStatus {
    let status: ReceivableStatus;
    if (isZero(allocated)) {
      status = ReceivableStatus.UNPAID;
    } else if (gte(allocated, receivable.totalAmount)) {
      status = ReceivableStatus.PAID;
    } else {
      status = ReceivableStatus.PARTIALLY_PAID;
    }

    if (
      status !== ReceivableStatus.PAID &&
      receivable.dueDate &&
      receivable.dueDate.getTime() < Date.now() &&
      !isZero(outstanding)
    ) {
      status = ReceivableStatus.OVERDUE;
    }

    return status;
  }
}
