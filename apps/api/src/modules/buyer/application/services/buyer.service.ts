import { Injectable, NotFoundException } from '@nestjs/common';
import { MilkBuyer, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { SellMilkUseCase } from 'src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import { computeMilkPrice } from '../../domain/milk-price';
import { CreateBuyerDto } from '../../presentation/dto/create-buyer.dto';
import { UpdateBuyerDto } from '../../presentation/dto/update-buyer.dto';
import { ListBuyerQueryDto } from '../../presentation/dto/list-buyer-query.dto';
import { RecordDispatchDto } from '../../presentation/dto/record-dispatch.dto';
import {
  DispatchQueryDto,
  StatementQueryDto,
} from '../../presentation/dto/dispatch-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

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
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BuyerService.name);
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
    return buyer;
  }

  async listBuyers(farmId: string, query: ListBuyerQueryDto) {
    const where: Prisma.MilkBuyerWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
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
    return toCursorPage(rows, query);
  }

  async getBuyer(farmId: string, id: string) {
    return this.getBuyerOrThrow(farmId, id);
  }

  async updateBuyer(farmId: string, id: string, dto: UpdateBuyerDto) {
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
    return buyer;
  }

  async deactivateBuyer(farmId: string, id: string) {
    await this.getBuyerOrThrow(farmId, id);
    const buyer = await this.prisma.milkBuyer.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Milk buyer deactivated', { buyerId: id, farmId });
    return buyer;
  }

  // ---- Dispatch ------------------------------------------------------------

  async recordDispatch(farmId: string, userId: string, dto: RecordDispatchDto) {
    const buyer = await this.getBuyerOrThrow(farmId, dto.buyerId);
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
        const dispatch = await tx.milkDispatch.create({
          data: {
            farmId,
            buyerId: buyer.id,
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
            createdBy: userId,
          },
        });

        // A zero-volume dispatch (logged for record purposes only) posts no
        // sale at all — same no-op the old `sellFromTank` had for
        // `volumeL <= 0`. Every real dispatch posts through SellMilkUseCase:
        // Sale + SaleLine(MILK) + MilkSaleLine, tank decrement, journal,
        // Receivable — unpaid at record time (`amountReceived` 0, PRD §11.3's
        // own convention — settled later via the generic
        // `POST /finance/payments` + `/allocations` routes).
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
      buyerName: buyer.name,
      volumeDispatchedL: dispatch.volumeDispatchedL,
      volumeReceivedL: dispatch.volumeReceivedL,
      discrepancyL,
      discrepancyFlagged,
      calculatedAmount: breakdown.total,
      priceBreakdown: breakdown,
      paymentDueDate,
      tankUpdated,
      saleId,
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
    };
    const rows = await this.prisma.milkDispatch.findMany({
      where,
      orderBy: [{ dispatchedAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { buyer: { select: { id: true, name: true } } },
    });
    return toCursorPage(rows, query);
  }

  async statement(farmId: string, buyerId: string, query: StatementQueryDto) {
    const buyer = await this.getBuyerOrThrow(farmId, buyerId);
    const [year, month] = query.month.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const dispatches = await this.prisma.milkDispatch.findMany({
      where: { farmId, buyerId, dispatchedAt: { gte: start, lt: end } },
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

  private async getBuyerOrThrow(
    farmId: string,
    id: string,
  ): Promise<MilkBuyer> {
    const buyer = await this.prisma.milkBuyer.findFirst({
      where: { id, farmId },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }
    return buyer;
  }
}
