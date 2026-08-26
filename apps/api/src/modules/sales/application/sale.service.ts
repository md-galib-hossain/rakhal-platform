import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  clampNonNegative,
  gte as moneyGte,
  isZero,
  multiply,
  subtract,
  sum,
  toStorage,
} from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';
import { validateSaleLineDetailShape } from '../domain/sale-line-shape';
import { SaleNumberAllocator } from '../infrastructure/sale-number.allocator';
import { CreateSaleDto } from '../presentation/dto/create-sale.dto';
import { CreateSaleLineDto } from '../presentation/dto/create-sale-line.dto';
import { ListSalesQueryDto } from '../presentation/dto/list-sales-query.dto';

/** `Sale` with every line's typed detail eagerly loaded — the shape every read
 * route (and every future sale-type use case) works with. */
const SALE_INCLUDE = {
  lines: {
    include: {
      unit: true,
      milkDetail: true,
      animalDetail: true,
      inventoryDetail: true,
      manureDetail: true,
    },
  },
} satisfies Prisma.SaleInclude;

export type SaleWithLines = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

/** One row of `GET /sales` v2's projected list (RAKHAL-368). */
export interface SaleListRow {
  id: string;
  saleNumber: string;
  saleDate: Date;
  status: SaleStatus;
  customer: { id: string; name: string } | null;
  totalAmount: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: ReceivableStatus;
  dueDate: Date | null;
  lineSummary: {
    type: SaleLineType | null;
    description: string | null;
    quantity: number;
  };
}

type ReceivableLike = {
  id: string;
  totalAmount: Prisma.Decimal;
  dueDate: Date | null;
  closedAt: Date | null;
} | null;

/**
 * A sale with no `Receivable` was paid in full at creation — `PAID` by
 * definition (RAKHAL-368's own AC: "A Sale with no Receivable ... is `Paid`
 * by definition"). Otherwise mirrors `ReceivableService`'s own
 * `deriveStatus` exactly (allocated==0 -> UNPAID, allocated>=total -> PAID,
 * else PARTIALLY_PAID; OVERDUE takes priority when `dueDate` has passed and
 * the receivable isn't fully paid) — kept as a second, read-projection-local
 * implementation rather than importing `ReceivableService` itself, since
 * `Sales` must not depend on `Finance V2`'s receivables *service* (only the
 * schema-level `Receivable` relation, same "no Nest module import" precedent
 * `assertCustomerBelongsToFarm` already set). The equivalence e2e is what
 * proves this copy never drifts from the real one.
 */
function deriveSalePaymentStatus(
  receivable: ReceivableLike,
  allocated: Prisma.Decimal,
  outstanding: Prisma.Decimal,
): ReceivableStatus {
  if (!receivable) {
    return ReceivableStatus.PAID;
  }

  let status: ReceivableStatus;
  if (isZero(allocated)) {
    status = ReceivableStatus.UNPAID;
  } else if (moneyGte(allocated, receivable.totalAmount)) {
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

/**
 * SQL `where` fragment for `?paymentStatus=`, expressed against the
 * `receivable` relation so the filter is SQL-level, never page
 * post-filtering (RAKHAL-368's own AC). `UNPAID`/`PARTIALLY_PAID` both
 * additionally exclude an overdue receivable — the literal AC formula reads
 * as independent conditions, but `OVERDUE` takes priority in
 * `deriveSalePaymentStatus`/`ReceivableService.getStatus`, so the filter
 * must match that same priority for the equivalence e2e to hold.
 */
function buildPaymentStatusWhere(
  status: ReceivableStatus,
): Prisma.SaleWhereInput {
  const now = new Date();
  const notOverdue: Prisma.SaleWhereInput = {
    OR: [
      { receivable: { dueDate: null } },
      { receivable: { dueDate: { gte: now } } },
    ],
  };

  switch (status) {
    case ReceivableStatus.PAID:
      return {
        OR: [{ receivable: null }, { receivable: { closedAt: { not: null } } }],
      };
    case ReceivableStatus.UNPAID:
      return {
        AND: [
          { receivable: { isNot: null } },
          { receivable: { closedAt: null } },
          { receivable: { allocations: { none: {} } } },
          notOverdue,
        ],
      };
    case ReceivableStatus.PARTIALLY_PAID:
      return {
        AND: [
          { receivable: { isNot: null } },
          { receivable: { closedAt: null } },
          { receivable: { allocations: { some: {} } } },
          notOverdue,
        ],
      };
    case ReceivableStatus.OVERDUE:
      return {
        AND: [
          { receivable: { isNot: null } },
          { receivable: { closedAt: null } },
          { receivable: { dueDate: { lt: now } } },
        ],
      };
  }
}

/**
 * Sales document engine (RAKHAL-339, Sales module — `FINANCE_V2_DESIGN.md` §4.3,
 * §5.1). **This ticket's scope is the document model + persistence + numbering
 * only** — `createSale` does NOT post journal entries, create a `Receivable`, or
 * decrement any stock. Those are RAKHAL-340 (Receivable v2) and the per-sale-type
 * use cases (RAKHAL-342 SellMilk / RAKHAL-345 SellAnimal / RAKHAL-346
 * SellInventoryItem / RAKHAL-347 RecordManureSale), which call `createSale` as the
 * first step of their own `$transaction` and continue with their own stock/ledger
 * side effects on the same client.
 *
 * `createSale(farmId, userId, dto, tx?)` follows the same `tx ?? this.prisma.
 * $transaction(...)` seam every other Finance V2 service uses (RAKHAL-335/337) so a
 * later use-case ticket can pass its own already-open transaction client straight
 * through and get one atomic unit covering Sale+SaleLine+typed-detail+its own
 * domain mutation.
 */
@Injectable()
export class SaleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleNumberAllocator: SaleNumberAllocator,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SaleService.name);
  }

  async createSale(
    farmId: string,
    userId: string,
    dto: CreateSaleDto,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleWithLines> {
    const run = (client: Prisma.TransactionClient) =>
      this.createWithClient(client, farmId, userId, dto);
    return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreateSaleDto,
  ): Promise<SaleWithLines> {
    for (const line of dto.lines) {
      const error = validateSaleLineDetailShape(line);
      if (error) {
        throw new BadRequestException(error);
      }
    }

    const lineComputations = dto.lines.map((line) => ({
      line,
      totalAmount: toStorage(multiply(line.quantity, line.unitPrice)),
    }));
    const subtotal = toStorage(sum(lineComputations.map((c) => c.totalAmount)));
    const discountAmount = toStorage(dto.discountAmount ?? 0);
    const totalAmount = clampNonNegative(subtract(subtotal, discountAmount));

    if (dto.customerId) {
      await this.assertCustomerBelongsToFarm(client, farmId, dto.customerId);
    }

    const saleNumber = await this.saleNumberAllocator.allocate(client, farmId);

    const sale = await client.sale.create({
      data: {
        farmId,
        saleNumber,
        customerId: dto.customerId ?? null,
        saleDate: new Date(dto.saleDate),
        subtotal,
        discountAmount,
        totalAmount,
        status: SaleStatus.DRAFT,
        notes: dto.notes ?? null,
        createdById: userId,
      },
    });

    for (const { line, totalAmount: lineTotal } of lineComputations) {
      const saleLine = await client.saleLine.create({
        data: {
          saleId: sale.id,
          type: line.type,
          description: line.description,
          quantity: toStorage(line.quantity),
          unitId: line.unitId ?? null,
          unitPrice: toStorage(line.unitPrice),
          totalAmount: lineTotal,
        },
      });
      await this.createLineDetail(client, farmId, saleLine.id, line);
    }

    this.log.info('Sale created', {
      farmId,
      saleId: sale.id,
      saleNumber,
      lineCount: dto.lines.length,
      totalAmount: totalAmount.toString(),
    });

    return this.getOrThrow(client, farmId, sale.id);
  }

  private async createLineDetail(
    client: Prisma.TransactionClient,
    farmId: string,
    saleLineId: string,
    line: CreateSaleLineDto,
  ): Promise<void> {
    switch (line.type) {
      case SaleLineType.MILK:
        await client.milkSaleLine.create({ data: { saleLineId } });
        return;

      case SaleLineType.ANIMAL: {
        const cattle = await client.cattle.findFirst({
          where: { id: line.cattleId, farmId },
          select: { id: true },
        });
        if (!cattle) {
          throw new NotFoundException('Cattle not found for ANIMAL sale line');
        }
        await client.animalSaleLine.create({
          data: { saleLineId, cattleId: cattle.id },
        });
        return;
      }

      case SaleLineType.INVENTORY: {
        if (line.medicineId) {
          const medicine = await client.medicine.findFirst({
            where: { id: line.medicineId, farmId },
            select: { id: true },
          });
          if (!medicine) {
            throw new NotFoundException(
              'Medicine not found for INVENTORY sale line',
            );
          }
        } else if (line.feedItemId) {
          const feedItem = await client.feedItem.findFirst({
            where: { id: line.feedItemId, farmId },
            select: { id: true },
          });
          if (!feedItem) {
            throw new NotFoundException(
              'Feed item not found for INVENTORY sale line',
            );
          }
        } else if (line.equipmentId) {
          const equipment = await client.equipment.findFirst({
            where: { id: line.equipmentId, farmId },
            select: { id: true },
          });
          if (!equipment) {
            throw new NotFoundException(
              'Equipment not found for INVENTORY sale line',
            );
          }
        }
        await client.inventorySaleLine.create({
          data: {
            saleLineId,
            medicineId: line.medicineId ?? null,
            feedItemId: line.feedItemId ?? null,
            equipmentId: line.equipmentId ?? null,
          },
        });
        return;
      }

      case SaleLineType.MANURE:
        await client.manureSaleLine.create({
          data: { saleLineId, notes: line.manureNotes ?? null },
        });
    }
  }

  async findOne(farmId: string, id: string): Promise<SaleWithLines> {
    return this.getOrThrow(this.prisma, farmId, id);
  }

  /**
   * `GET /sales` v2 (RAKHAL-368, MILESTONE 22 — `BUSINESS_IA_PRD.md` §5.9,
   * §6.4). Cursor-paginated, filtered, row-projected — replaces the old
   * unfiltered/unpaginated `findMany` (RAKHAL-364's own documented gap).
   * `paymentStatus` is a real SQL `where` against the `receivable` relation
   * (`buildPaymentStatusWhere`), never page post-filtering — the aggregate
   * must span the whole farm, not just the current page.
   */
  async findAll(
    farmId: string,
    query: ListSalesQueryDto,
  ): Promise<CursorPage<SaleListRow>> {
    const where: Prisma.SaleWhereInput = {
      farmId,
      status:
        query.status ??
        (query.includeDrafts ? undefined : { not: SaleStatus.DRAFT }),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? {
            saleDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.lineType ? { lines: { some: { type: query.lineType } } } : {}),
      ...(query.q
        ? {
            OR: [
              { saleNumber: { contains: query.q, mode: 'insensitive' } },
              {
                lines: {
                  some: {
                    description: { contains: query.q, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.paymentStatus
        ? buildPaymentStatusWhere(query.paymentStatus)
        : {}),
    };

    const rows = await this.prisma.sale.findMany({
      where,
      orderBy: [{ saleDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: {
        customer: { select: { id: true, name: true } },
        lines: { select: { type: true, description: true, quantity: true } },
        receivable: {
          select: {
            id: true,
            totalAmount: true,
            dueDate: true,
            closedAt: true,
          },
        },
      },
    });

    const page = toCursorPage(rows, query);
    if (page.items.length === 0) {
      return { items: [], meta: page.meta };
    }

    const receivableIds = page.items
      .map((s) => s.receivable?.id)
      .filter((id): id is string => id != null);
    const sums = receivableIds.length
      ? await this.prisma.paymentAllocation.groupBy({
          by: ['receivableId'],
          where: { receivableId: { in: receivableIds } },
          _sum: { amount: true },
        })
      : [];
    const allocatedByReceivableId = new Map(
      sums.map((s) => [s.receivableId as string, s._sum.amount ?? 0]),
    );

    const items = page.items.map((sale) =>
      this.toListRow(sale, allocatedByReceivableId),
    );
    return { items, meta: page.meta };
  }

  private toListRow(
    sale: Prisma.SaleGetPayload<{
      include: {
        customer: { select: { id: true; name: true } };
        lines: { select: { type: true; description: true; quantity: true } };
        receivable: {
          select: {
            id: true;
            totalAmount: true;
            dueDate: true;
            closedAt: true;
          };
        };
      };
    }>,
    allocatedByReceivableId: Map<string, Prisma.Decimal | number>,
  ): SaleListRow {
    const receivable = sale.receivable;
    const allocated = receivable
      ? toStorage(allocatedByReceivableId.get(receivable.id) ?? 0)
      : toStorage(0);
    const paidAmount = receivable ? allocated : toStorage(sale.totalAmount);
    const dueAmount = receivable
      ? clampNonNegative(subtract(receivable.totalAmount, allocated))
      : toStorage(0);
    const paymentStatus = deriveSalePaymentStatus(
      receivable,
      allocated,
      dueAmount,
    );

    const first = sale.lines[0];
    const totalQuantity = sale.lines.reduce(
      (s, l) => s + Number(l.quantity),
      0,
    );

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      status: sale.status,
      customer: sale.customer
        ? { id: sale.customer.id, name: sale.customer.name }
        : null,
      totalAmount: sale.totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      dueAmount: dueAmount.toString(),
      paymentStatus,
      dueDate: receivable?.dueDate ?? null,
      lineSummary: {
        type: first?.type ?? null,
        description:
          sale.lines.length > 1
            ? `${sale.lines.length} items`
            : (first?.description ?? null),
        quantity: totalQuantity,
      },
    };
  }

  /**
   * RAKHAL-364 — `Sale.customerId` is now a real Prisma FK to `MilkBuyer`,
   * but a Prisma FK cannot enforce `Sale.farmId == MilkBuyer.farmId`, only
   * that the row exists somewhere. Without this assert, promoting the
   * column to a FK would *open* a cross-tenant hole it did not have as a
   * bare scalar: a caller could point a sale at another farm's buyer and
   * the constraint alone would let it through. Same inline
   * `findFirst({ id, farmId })` pattern `createLineDetail`'s ANIMAL branch
   * already uses to validate `cattleId` a few lines below — no separate
   * service, no Nest module import (`SalesModule` does not import
   * `BuyerModule`; `PrismaService` reaches `MilkBuyer` at the schema level
   * only, same precedent `AnimalSaleLine.cattleId` set, RAKHAL-344).
   */
  private async assertCustomerBelongsToFarm(
    client: Prisma.TransactionClient,
    farmId: string,
    customerId: string,
  ): Promise<void> {
    const buyer = await client.milkBuyer.findFirst({
      where: { id: customerId, farmId },
      select: { id: true },
    });
    if (!buyer) {
      throw new BadRequestException('customerId not found for this farm');
    }
  }

  private async getOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    farmId: string,
    id: string,
  ): Promise<SaleWithLines> {
    const sale = await client.sale.findFirst({
      where: { id, farmId },
      include: SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }
}
