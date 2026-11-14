import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  BuyerType,
  MilkBuyer,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { toStorage } from 'src/common/money';
import { SellMilkUseCase } from 'src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import { VoidSaleUseCase } from 'src/modules/sales/application/use-cases/void-sale/void-sale.use-case';
import { computeMilkPrice } from '../../domain/milk-price';
import {
  DispatchStatus,
  deriveDispatchStatus,
} from '../../domain/dispatch-status';
import { DispatchNumberAllocator } from '../../infrastructure/dispatch-number.allocator';
import { CreateBuyerDto } from '../../presentation/dto/create-buyer.dto';
import { UpdateBuyerDto } from '../../presentation/dto/update-buyer.dto';
import { ListBuyerQueryDto } from '../../presentation/dto/list-buyer-query.dto';
import { RecordDispatchDto } from '../../presentation/dto/record-dispatch.dto';
import { RecordReceiptDto } from '../../presentation/dto/record-receipt.dto';
import {
  DispatchQueryDto,
  StatementQueryDto,
} from '../../presentation/dto/dispatch-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Translates the derived `DispatchStatus` (RAKHAL-366) into a real Prisma
 * `where` predicate against `cancelledAt`/`volumeReceivedL` — never
 * page-post-filtered. Same convention `buildPurchasePaymentStatusWhere`
 * (`purchase.service.ts`) established for `paymentStatus`. */
function buildDispatchStatusWhere(
  status?: DispatchStatus,
): Prisma.MilkDispatchWhereInput {
  switch (status) {
    case 'CANCELLED':
      return { cancelledAt: { not: null } };
    case 'PENDING':
      return { cancelledAt: null, volumeReceivedL: null };
    case 'DELIVERED':
      return { cancelledAt: null, volumeReceivedL: { not: null } };
    default:
      return {};
  }
}

/**
 * Milk Sales & Buyer Management (PRD §11). Farm-scoped (`farmId` from the token
 * context). Recording a dispatch prices the milk (quality-adjusted, §11.4) and
 * atomically posts the whole sale — the milk tank decrement, the `Sale`/
 * `Receivable`/journal posting, all in one transaction — via `SellMilkUseCase`
 * (RAKHAL-342, Finance V2). A monthly statement reconciles dispatched vs
 * accepted volume and amount due vs paid (§11.3) against that same `Sale`'s
 * `Receivable`.
 *
 * **RAKHAL-342 replaced the old split path** (`FINANCE_V2_DESIGN.md` §1.2):
 * `recordDispatch` used to open its own `$transaction` for the dispatch row +
 * tank decrement, then post to V1 Finance in a best-effort `try/catch` *after*
 * that transaction had already committed — so a Finance hiccup left milk gone
 * from the tank with no ledger entry anywhere. Now the dispatch row, the tank
 * decrement, the `Sale`, the `Receivable` and the journal posting are all one
 * atomic unit: a dispatch can no longer exist without a corresponding sale.
 */
@Injectable()
export class BuyerService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sellMilkUseCase: SellMilkUseCase,
    private readonly voidSaleUseCase: VoidSaleUseCase,
    private readonly dispatchNumberAllocator: DispatchNumberAllocator,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BuyerService.name);
  }

  /** Post-commit Activity Log entry. Never throws — a log hiccup must not turn a
   * committed buyer/dispatch change into a 500 (same rule `VoidSaleUseCase` uses). */
  private async recordActivity(
    farmId: string,
    userId: string,
    eventTitle: string,
    actionDetails: string,
    financialImpact?: number,
  ): Promise<void> {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle,
        actionDetails,
        actorId: userId,
        ...(financialImpact !== undefined ? { financialImpact } : {}),
      });
    } catch (error) {
      this.log.error('Buyer activity log failed', {
        farmId,
        eventTitle,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ---- Buyers --------------------------------------------------------------

  async createBuyer(farmId: string, userId: string, dto: CreateBuyerDto) {
    const buyer = await this.prisma.milkBuyer.create({
      data: {
        farmId,
        name: dto.name,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        buyerType: dto.buyerType,
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        basePricePerLitre: dto.basePricePerLitre,
        baseFatPct: dto.baseFatPct ?? 3.5,
        fatBonusPer01Pct: dto.fatBonusPer01Pct ?? 0,
        sccThreshold: dto.sccThreshold ?? 200_000,
        sccPenaltyPer100k: dto.sccPenaltyPer100k ?? 0,
        collectionDays: dto.collectionDays ?? [],
        collectionTime: dto.collectionTime,
        bankDetails: dto.bankDetails,
        createdBy: userId,
      },
    });
    this.log.info('Milk buyer created', { buyerId: buyer.id, farmId });
    await this.recordActivity(
      farmId,
      userId,
      'Buyer Added',
      `Buyer "${buyer.name}" added (৳${buyer.basePricePerLitre}/L, ${buyer.paymentTermsDays}-day terms).`,
    );
    return buyer;
  }

  async listBuyers(farmId: string, query: ListBuyerQueryDto) {
    const where: Prisma.MilkBuyerWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                contactPerson: { contains: query.search, mode: 'insensitive' },
              },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.milkBuyer.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    if (page.items.length === 0) {
      return { items: [], meta: page.meta };
    }

    const [purchaseAgg, outstanding] = await Promise.all([
      this.purchaseAggByCustomer(farmId),
      this.receivableOutstandingByCustomer(farmId),
    ]);
    const purchaseById = new Map(purchaseAgg.map((r) => [r.customerId, r]));
    const outstandingById = new Map(
      outstanding.map((r) => [r.customer_id, r.outstanding]),
    );

    const items = page.items.map((buyer) => {
      const purchase = purchaseById.get(buyer.id);
      return {
        ...buyer,
        totalPurchased: toStorage(purchase?.totalAmount ?? 0).toString(),
        lastPurchaseAt: purchase?.lastSaleAt?.toISOString() ?? null,
        outstanding: toStorage(outstandingById.get(buyer.id) ?? 0).toString(),
        status: !buyer.deletedAt ? 'ACTIVE' : 'INACTIVE',
      };
    });
    return { items, meta: page.meta };
  }

  /** `GET /buyers/summary` (RAKHAL-372) — Total Buyers / Active Buyers /
   * Total Sales / Total Outstanding across the farm's whole buyer book. */
  async getBuyersSummary(farmId: string) {
    const [totalBuyers, activeBuyers, purchaseAgg, outstanding] =
      await Promise.all([
        this.prisma.milkBuyer.count({ where: { farmId } }),
        this.prisma.milkBuyer.count({ where: { farmId, deletedAt: null } }),
        this.purchaseAggByCustomer(farmId),
        this.receivableOutstandingByCustomer(farmId),
      ]);

    const totalSales = purchaseAgg.reduce(
      (sum, r) => sum.plus(toStorage(r.totalAmount ?? 0)),
      toStorage(0),
    );
    const totalOutstanding = outstanding.reduce(
      (sum, r) => sum.plus(toStorage(r.outstanding ?? 0)),
      toStorage(0),
    );

    return {
      totalBuyers,
      activeBuyers,
      totalSales: totalSales.toString(),
      totalOutstanding: totalOutstanding.toString(),
    };
  }

  /** `GET /buyers/:id/overview` (RAKHAL-372) — the detail-header data: this
   * year's purchases, current outstanding, the most recent payment applied
   * to any of this buyer's receivables, and a handful of recent invoices. */
  async getBuyerOverview(farmId: string, id: string) {
    const buyer = await this.getBuyerOrThrow(farmId, id);
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

    const [thisYearAgg, outstandingRows, lastPaymentRows, recentInvoices] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: { farmId, customerId: id, saleDate: { gte: yearStart } },
          _sum: { totalAmount: true },
        }),
        this.receivableOutstandingByCustomer(farmId, id),
        this.prisma.$queryRaw<{ amount: string; date: Date }[]>(Prisma.sql`
        SELECT p."amount"::text AS amount, p."transactionDate" AS date
        FROM "PaymentAllocation" pa
        JOIN "FinancePayment" p ON p.id = pa."paymentId"
        JOIN "Receivable" r ON r.id = pa."receivableId"
        WHERE r."customerId" = ${id} AND r."farmId" = ${farmId}
        ORDER BY p."transactionDate" DESC
        LIMIT 1
      `),
        this.prisma.sale.findMany({
          where: { farmId, customerId: id },
          orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
          take: 5,
          select: {
            id: true,
            saleNumber: true,
            saleDate: true,
            totalAmount: true,
            status: true,
          },
        }),
      ]);

    const lastPayment = lastPaymentRows[0]
      ? {
          amount: toStorage(lastPaymentRows[0].amount).toString(),
          date: lastPaymentRows[0].date.toISOString(),
        }
      : null;

    return {
      outstandingAmount: toStorage(
        outstandingRows[0]?.outstanding ?? 0,
      ).toString(),
      totalPurchasedThisYear: toStorage(
        thisYearAgg._sum.totalAmount ?? 0,
      ).toString(),
      lastPayment,
      recentInvoices: recentInvoices.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        saleDate: s.saleDate.toISOString(),
        totalAmount: toStorage(s.totalAmount).toString(),
        status: s.status,
      })),
      info: {
        phone: buyer.phone,
        // No `address` column exists on `MilkBuyer` — not in this ticket's
        // Lane (application/presentation only, no migration) — always null
        // until a future schema pass adds one.
        address: null,
        paymentTermsDays: buyer.paymentTermsDays,
        basePricePerLitre: buyer.basePricePerLitre,
        buyerType: buyer.buyerType,
      },
    };
  }

  /** `GET /buyers/groups` (RAKHAL-372) — "Buyer Groups" is the existing
   * `BuyerType` enum, not a new model: one row per enum value with its
   * buyer count and total sales, zero-filled for a value with no buyers. */
  async getBuyerGroups(farmId: string) {
    const [buyers, purchaseAgg] = await Promise.all([
      this.prisma.milkBuyer.findMany({
        where: { farmId },
        select: { id: true, buyerType: true },
      }),
      this.purchaseAggByCustomer(farmId),
    ]);
    const purchaseById = new Map(purchaseAgg.map((r) => [r.customerId, r]));

    const totals = new Map<
      string,
      { buyerCount: number; totalSales: ReturnType<typeof toStorage> }
    >();
    for (const buyer of buyers) {
      const entry = totals.get(buyer.buyerType) ?? {
        buyerCount: 0,
        totalSales: toStorage(0),
      };
      entry.buyerCount += 1;
      entry.totalSales = entry.totalSales.plus(
        toStorage(purchaseById.get(buyer.id)?.totalAmount ?? 0),
      );
      totals.set(buyer.buyerType, entry);
    }

    return Object.values(BuyerType).map((buyerType) => {
      const entry = totals.get(buyerType);
      return {
        buyerType,
        buyerCount: entry?.buyerCount ?? 0,
        totalSales: (entry?.totalSales ?? toStorage(0)).toString(),
      };
    });
  }

  /** `Sale.totalAmount` summed + `MAX(saleDate)`, grouped by `customerId` —
   * plain Prisma `groupBy` suffices (no join needed), same shape
   * `SupplierReadService.purchaseAggBySupplier` uses on the purchasing
   * side. */
  private async purchaseAggByCustomer(farmId: string) {
    const rows = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: { farmId, customerId: { not: null } },
      _sum: { totalAmount: true },
      _max: { saleDate: true },
    });
    return rows.map((r) => ({
      customerId: r.customerId,
      totalAmount: r._sum.totalAmount?.toString() ?? null,
      lastSaleAt: r._max.saleDate,
    }));
  }

  /** Outstanding `Receivable` balance per buyer (`totalAmount -
   * SUM(PaymentAllocation.amount)`), optionally scoped to one buyer —
   * same raw-SQL CTE shape `AgingService`/`SupplierReadService` already
   * established; a computed value needing a `LEFT JOIN` sum before
   * `GROUP BY`, which `Prisma.groupBy` alone cannot express. `farmId`/
   * `customerId` are real bound parameters, never string-concatenated. */
  private async receivableOutstandingByCustomer(
    farmId: string,
    customerId?: string,
  ): Promise<{ customer_id: string; outstanding: string | null }[]> {
    return this.prisma.$queryRaw<
      { customer_id: string; outstanding: string | null }[]
    >(Prisma.sql`
      WITH allocation_sums AS (
        SELECT "receivableId" AS doc_id, SUM(amount) AS allocated
        FROM "PaymentAllocation"
        WHERE "receivableId" IS NOT NULL
        GROUP BY "receivableId"
      )
      SELECT
        d."customerId" AS customer_id,
        SUM(d."totalAmount" - COALESCE(a.allocated, 0))::text AS outstanding
      FROM "Receivable" d
      LEFT JOIN allocation_sums a ON a.doc_id = d.id
      WHERE d."farmId" = ${farmId} AND d."customerId" IS NOT NULL
        ${customerId ? Prisma.sql`AND d."customerId" = ${customerId}` : Prisma.empty}
      GROUP BY d."customerId"
    `);
  }

  async getBuyer(farmId: string, id: string) {
    return this.getBuyerOrThrow(farmId, id);
  }

  async updateBuyer(
    farmId: string,
    userId: string,
    id: string,
    dto: UpdateBuyerDto,
  ) {
    await this.getBuyerOrThrow(farmId, id);
    const buyer = await this.prisma.milkBuyer.update({
      where: { id },
      data: {
        name: dto.name,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        buyerType: dto.buyerType,
        paymentTermsDays: dto.paymentTermsDays,
        basePricePerLitre: dto.basePricePerLitre,
        baseFatPct: dto.baseFatPct,
        fatBonusPer01Pct: dto.fatBonusPer01Pct,
        sccThreshold: dto.sccThreshold,
        sccPenaltyPer100k: dto.sccPenaltyPer100k,
        collectionDays: dto.collectionDays,
        collectionTime: dto.collectionTime,
        bankDetails: dto.bankDetails,
      },
    });
    this.log.info('Milk buyer updated', { buyerId: id, farmId });
    await this.recordActivity(
      farmId,
      userId,
      'Buyer Updated',
      `Buyer "${buyer.name}" updated.`,
    );
    return buyer;
  }

  async deactivateBuyer(farmId: string, userId: string, id: string) {
    await this.getBuyerOrThrow(farmId, id);
    const buyer = await this.prisma.milkBuyer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.log.info('Milk buyer deactivated', { buyerId: id, farmId });
    await this.recordActivity(
      farmId,
      userId,
      'Buyer Deactivated',
      `Buyer "${buyer.name}" deactivated.`,
    );
    return buyer;
  }

  // ---- Dispatch ------------------------------------------------------------

  async recordDispatch(farmId: string, userId: string, dto: RecordDispatchDto) {
    const buyer = await this.getBuyerOrThrow(farmId, dto.buyerId, {
      requireActive: true,
    });
    const dispatchedAt = new Date(dto.dispatchedAt);

    const pricedVolume = dto.volumeReceivedL ?? dto.volumeDispatchedL;
    const breakdown = computeMilkPrice({
      volumeL: pricedVolume,
      basePricePerLitre: buyer.basePricePerLitre,
      fatPct: dto.fatPct ?? null,
      baseFatPct: buyer.baseFatPct,
      fatBonusPer01Pct: buyer.fatBonusPer01Pct,
      scc: dto.scc ?? null,
      sccThreshold: buyer.sccThreshold,
      sccPenaltyPer100k: buyer.sccPenaltyPer100k,
    });

    const discrepancyL =
      dto.volumeReceivedL == null
        ? null
        : Math.round((dto.volumeDispatchedL - dto.volumeReceivedL) * 100) / 100;
    const discrepancyFlagged = discrepancyL != null && discrepancyL !== 0;

    const paymentDueDate =
      buyer.paymentTermsDays > 0
        ? new Date(dispatchedAt.getTime() + buyer.paymentTermsDays * DAY_MS)
        : null;

    // RAKHAL-342: dispatch creation, the tank SALE decrement, the Sale/
    // SaleLine/MilkSaleLine, the Accounts-Receivable/Milk-Sales journal
    // posting and the Receivable now all commit as ONE transaction — a
    // dispatch can no longer exist without a corresponding sale, and an
    // insufficient-volume rejection (or any other failure in that chain)
    // rolls back every one of them, dispatch row included.
    //
    // `pricePerLitre` passed to `SellMilkUseCase` is the dispatch's own
    // *effective* rate (`breakdown.total / volumeDispatchedL`), not
    // `buyer.basePricePerLitre` — so `Sale.totalAmount` matches `MilkDispatch
    // .calculatedAmount` exactly, fat-bonus/SCC-penalty included, without
    // `SellMilkUseCase` needing to know anything about quality adjustments
    // (that pricing logic stays owned by `computeMilkPrice`/this module).
    const effectivePricePerLitre =
      dto.volumeDispatchedL > 0 ? breakdown.total / dto.volumeDispatchedL : 0;

    const { dispatch, tankUpdated, saleId } = await this.prisma.$transaction(
      async (tx) => {
        const dispatchNumber = await this.dispatchNumberAllocator.allocate(
          tx,
          farmId,
        );
        const dispatch = await tx.milkDispatch.create({
          data: {
            farmId,
            buyerId: buyer.id,
            dispatchNumber,
            dispatchedAt,
            volumeDispatchedL: dto.volumeDispatchedL,
            volumeReceivedL: dto.volumeReceivedL,
            fatPct: dto.fatPct,
            scc: dto.scc,
            discrepancyL,
            discrepancyFlagged,
            basePricePerLitre: buyer.basePricePerLitre,
            fatBonus: breakdown.fatBonus,
            sccPenalty: breakdown.sccPenalty,
            calculatedAmount: breakdown.total,
            paymentDueDate,
            notes: dto.notes,
            driverName: dto.driverName,
            createdBy: userId,
          },
        });

        // A zero-volume dispatch (logged for record purposes only) posts no
        // sale at all — same no-op the old `sellFromTank` had for
        // `volumeL <= 0`. Every real dispatch posts through SellMilkUseCase:
        // Sale + SaleLine(MILK) + MilkSaleLine, tank decrement, journal,
        // Receivable — unpaid unless the farmer took money at the point of sale
        // (`amountReceived`, with its `paymentMethod`): then the Payment +
        // allocation post in this same transaction. Otherwise it is settled
        // later via the generic `POST /finance/payments` + `/allocations` routes.
        let tankUpdated = false;
        let saleId: string | null = null;
        if (dto.volumeDispatchedL > 0) {
          const result = await this.sellMilkUseCase.execute(
            farmId,
            userId,
            {
              volumeL: dto.volumeDispatchedL,
              pricePerLitre: effectivePricePerLitre,
              customerId: buyer.id,
              saleDate: dispatchedAt.toISOString(),
              description: `Milk dispatch to ${buyer.name}`,
              notes: `Milk dispatch ${dispatch.id}`,
              dueDate: paymentDueDate,
              amountReceived: dto.amountReceived,
              paymentMethod: dto.paymentMethod,
              financialAccountId: dto.financialAccountId,
              referenceNumber: dto.referenceNumber,
            },
            tx,
          );
          tankUpdated = result.tankUpdated;
          saleId = result.sale.id;

          await tx.milkDispatch.update({
            where: { id: dispatch.id },
            data: { saleId },
          });
        }

        return { dispatch, tankUpdated, saleId };
      },
    );

    this.log.info('Milk dispatch recorded', {
      dispatchId: dispatch.id,
      farmId,
      buyerId: buyer.id,
      amount: breakdown.total,
      saleId,
    });

    return {
      id: dispatch.id,
      dispatchNumber: dispatch.dispatchNumber,
      buyerName: buyer.name,
      driverName: dispatch.driverName,
      volumeDispatchedL: dispatch.volumeDispatchedL,
      volumeReceivedL: dispatch.volumeReceivedL,
      discrepancyL,
      discrepancyFlagged,
      calculatedAmount: breakdown.total,
      priceBreakdown: breakdown,
      paymentDueDate,
      amountReceived: dto.amountReceived ?? 0,
      tankUpdated,
      saleId,
      status: deriveDispatchStatus(dispatch),
    };
  }

  async listDispatches(farmId: string, query: DispatchQueryDto) {
    const where: Prisma.MilkDispatchWhereInput = {
      farmId,
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.from || query.to
        ? {
            dispatchedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...buildDispatchStatusWhere(query.status),
    };
    const rows = await this.prisma.milkDispatch.findMany({
      where,
      orderBy: [{ dispatchedAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { buyer: { select: { id: true, name: true } } },
    });
    const page = toCursorPage(rows, query);
    return {
      ...page,
      items: page.items.map((d) => ({
        ...d,
        status: deriveDispatchStatus(d),
      })),
    };
  }

  /**
   * `POST /buyers/dispatches/:id/cancel` (RAKHAL-377, MILESTONE 22,
   * `BUSINESS_IA_PRD.md` §9.4, §16.2 — closes 366's own deferred AC). Gated
   * `finance.reverse` at the controller.
   *
   * `assertDispatchCancellable` (RAKHAL-366, `domain/dispatch-status.ts`)
   * used to unconditionally reject cancelling a dispatch with a posted
   * `saleId` — this ticket is the promised follow-on that closes that gap:
   * when the dispatch has a `saleId`, its sale is cascade-cancelled via
   * `VoidSaleUseCase.cancelSale` **inside the same transaction** as the
   * dispatch's own `cancelledAt` stamp, so a dispatch is never left
   * cancelled while its `JournalTransaction` stays posted (the exact defect
   * `assertDispatchCancellable`'s own doc comment warns about). If the sale
   * already has a payment allocated, `cancelSale` throws — same "refund
   * first" guard every other void path in this milestone enforces — and the
   * whole cancel (dispatch included) rolls back.
   */
  async cancelDispatch(farmId: string, userId: string, dispatchId: string) {
    const dispatch = await this.prisma.milkDispatch.findFirst({
      where: { id: dispatchId, farmId },
    });
    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }
    if (dispatch.cancelledAt) {
      throw new BadRequestException('Dispatch is already cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dispatch.saleId) {
        await this.voidSaleUseCase.cancelSale(
          farmId,
          userId,
          dispatch.saleId,
          tx,
        );
      }
      await tx.milkDispatch.update({
        where: { id: dispatchId },
        data: { cancelledAt: new Date() },
      });
    });

    this.log.info('Dispatch cancelled', {
      farmId,
      dispatchId,
      cascadedSaleId: dispatch.saleId,
    });
    // `cancelSale` skips its own log when handed our `tx`, so the cancel is
    // logged here, after the commit. The reversed amount is the sale total.
    const reversed = dispatch.saleId
      ? await this.prisma.sale.findFirst({
          where: { id: dispatch.saleId, farmId },
          select: { totalAmount: true },
        })
      : null;
    await this.recordActivity(
      farmId,
      userId,
      'Milk Dispatch Cancelled',
      `Dispatch ${dispatch.dispatchNumber} (${dispatch.volumeDispatchedL}L) cancelled${dispatch.saleId ? ' — sale reversed and milk returned to stock' : ''}.`,
      reversed ? -Number(reversed.totalAmount) : undefined,
    );

    const updated = await this.prisma.milkDispatch.findFirstOrThrow({
      where: { id: dispatchId, farmId },
    });
    return { ...updated, status: deriveDispatchStatus(updated) };
  }

  /**
   * `PATCH /buyers/dispatches/:id/receipt` (RAKHAL-378) — records the volume
   * actually received (recomputes `discrepancyL`/`discrepancyFlagged` off
   * the dispatch's own `volumeDispatchedL`, same formula `recordDispatch`
   * uses), moving a PENDING dispatch to DELIVERED (derived, see
   * `domain/dispatch-status.ts`). `driverName` is settable here too.
   * Idempotent — re-confirming a DELIVERED dispatch just overwrites the
   * figures; only a CANCELLED dispatch is rejected.
   */
  async recordReceipt(
    farmId: string,
    userId: string,
    dispatchId: string,
    dto: RecordReceiptDto,
  ) {
    const dispatch = await this.prisma.milkDispatch.findFirst({
      where: { id: dispatchId, farmId },
    });
    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }
    if (dispatch.cancelledAt) {
      throw new BadRequestException(
        'Dispatch is cancelled — receipt cannot be recorded',
      );
    }

    const discrepancyL =
      Math.round((dispatch.volumeDispatchedL - dto.volumeReceivedL) * 100) /
      100;

    const updated = await this.prisma.milkDispatch.update({
      where: { id: dispatchId },
      data: {
        volumeReceivedL: dto.volumeReceivedL,
        discrepancyL,
        discrepancyFlagged: discrepancyL !== 0,
        ...(dto.driverName !== undefined ? { driverName: dto.driverName } : {}),
      },
    });

    this.log.info('Dispatch receipt recorded', {
      farmId,
      dispatchId,
      volumeReceivedL: dto.volumeReceivedL,
      discrepancyL,
    });
    await this.recordActivity(
      farmId,
      userId,
      'Milk Receipt Confirmed',
      `Dispatch ${dispatch.dispatchNumber}: buyer received ${dto.volumeReceivedL}L of ${dispatch.volumeDispatchedL}L${discrepancyL !== 0 ? ` (${discrepancyL}L discrepancy)` : ''}.`,
    );

    return { ...updated, status: deriveDispatchStatus(updated) };
  }

  /** `GET /buyers/dispatches/summary` (RAKHAL-378) — Total / Delivered /
   * In Transit (PENDING) / Cancelled with % of total. Counts derived in
   * Node off a minimal-column fetch (`cancelledAt`/`volumeReceivedL`) —
   * cheap enough at farm scale, same judgment call `getBuyerGroups` makes
   * rather than reaching for raw SQL over a non-stored status. */
  async getDispatchesSummary(farmId: string) {
    const rows = await this.prisma.milkDispatch.findMany({
      where: { farmId },
      select: { cancelledAt: true, volumeReceivedL: true },
    });

    const counts = {
      total: rows.length,
      delivered: 0,
      inTransit: 0,
      cancelled: 0,
    };
    for (const row of rows) {
      const status = deriveDispatchStatus(row);
      if (status === 'DELIVERED') counts.delivered += 1;
      else if (status === 'PENDING') counts.inTransit += 1;
      else counts.cancelled += 1;
    }

    const pct = (n: number) =>
      counts.total > 0 ? Math.round((n / counts.total) * 1000) / 10 : 0;

    return {
      total: counts.total,
      delivered: { count: counts.delivered, pct: pct(counts.delivered) },
      inTransit: { count: counts.inTransit, pct: pct(counts.inTransit) },
      cancelled: { count: counts.cancelled, pct: pct(counts.cancelled) },
    };
  }

  async statement(farmId: string, buyerId: string, query: StatementQueryDto) {
    const buyer = await this.getBuyerOrThrow(farmId, buyerId);
    const [year, month] = query.month.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const dispatches = await this.prisma.milkDispatch.findMany({
      // A cancelled dispatch reversed its sale: it is neither dispatched, due nor paid.
      where: {
        farmId,
        buyerId,
        cancelledAt: null,
        dispatchedAt: { gte: start, lt: end },
      },
      orderBy: { dispatchedAt: 'asc' },
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalDispatchedL = round2(
      dispatches.reduce((s, d) => s + d.volumeDispatchedL, 0),
    );
    const totalReceivedL = round2(
      dispatches.reduce(
        (s, d) => s + (d.volumeReceivedL ?? d.volumeDispatchedL),
        0,
      ),
    );
    const qualityAdjustments = round2(
      dispatches.reduce((s, d) => s + d.fatBonus - d.sccPenalty, 0),
    );
    const totalDue = round2(
      dispatches.reduce((s, d) => s + d.calculatedAmount, 0),
    );
    // paidAmount was a dead field (nothing ever wrote it) — real payments
    // live on the V2 `Receivable` (via `PaymentAllocation`) linked from this
    // dispatch's `saleId` (RAKHAL-342). RAKHAL-354: dropped the legacy V1
    // `FinanceReceivable`/`financeTransactionId` fallback along with
    // `FinanceReceivable` itself — a dispatch with no `saleId` (recorded
    // before RAKHAL-342 shipped, dev/seed data only per `FINANCE_V2_DESIGN.md`
    // §2's "drop and rebuild" decision) now falls back straight to
    // `d.paidAmount` (always 0, the same dead field this comment already
    // documented), same honest-zero treatment every other RAKHAL-354 gap in
    // this codebase gets.
    const saleIds = dispatches
      .map((d) => d.saleId)
      .filter((id): id is string => id != null);
    const v2Receivables = saleIds.length
      ? await this.prisma.receivable.findMany({
          where: { farmId, saleId: { in: saleIds } },
          select: { saleId: true, id: true },
        })
      : [];
    const v2ReceivableIdBySale = new Map(
      v2Receivables.map((r) => [r.saleId, r.id]),
    );
    const v2Allocations = v2Receivables.length
      ? await this.prisma.paymentAllocation.groupBy({
          by: ['receivableId'],
          where: { receivableId: { in: v2Receivables.map((r) => r.id) } },
          _sum: { amount: true },
        })
      : [];
    const v2PaidByReceivable = new Map(
      v2Allocations.map((a) => [a.receivableId as string, a._sum.amount ?? 0]),
    );

    const totalPaid = round2(
      dispatches.reduce((s, d) => {
        if (d.saleId) {
          const receivableId = v2ReceivableIdBySale.get(d.saleId);
          const paid = receivableId
            ? Number(v2PaidByReceivable.get(receivableId) ?? 0)
            : 0;
          return s + paid;
        }
        return s + d.paidAmount;
      }, 0),
    );
    const baseAmount = round2(totalDue - qualityAdjustments);

    return {
      buyer: { id: buyer.id, name: buyer.name },
      month: query.month,
      totalDispatchedL,
      totalReceivedL,
      baseAmount,
      qualityAdjustments,
      totalDue,
      totalPaid,
      outstanding: round2(totalDue - totalPaid),
      dispatches,
    };
  }

  // ---- Helpers -------------------------------------------------------------

  /** `requireActive` is for anything that sells to the buyer: an archived buyer
   * stays readable (statements, history) but can no longer be dispatched to. */
  private async getBuyerOrThrow(
    farmId: string,
    id: string,
    opts?: { requireActive?: boolean },
  ): Promise<MilkBuyer> {
    const buyer = await this.prisma.milkBuyer.findFirst({
      where: { id, farmId },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }
    if (opts?.requireActive && buyer.deletedAt) {
      throw new BadRequestException(
        'This buyer is deactivated and cannot receive new sales',
      );
    }
    return buyer;
  }
}
