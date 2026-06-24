import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MilkBuyer,
  MilkTankActivity,
  MilkTankType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
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
 * decrements the Inventory SELLABLE tank via a SALE adjustment
 * (`MilkTankService.adjustVolume`); a monthly statement reconciles dispatched vs
 * accepted volume and amount due vs paid (§11.3).
 */
@Injectable()
export class BuyerService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly milkTankService: MilkTankService,
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
      ...(query.includeInactive ? {} : { isActive: true }),
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

    const dispatch = await this.prisma.milkDispatch.create({
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

    // Inventory (RD-005 SALE hook): dispatched milk leaves the SELLABLE tank.
    const tankUpdated = await this.sellFromTank(
      farmId,
      userId,
      dto.volumeDispatchedL,
      buyer.name,
    );

    this.log.info('Milk dispatch recorded', {
      dispatchId: dispatch.id,
      farmId,
      buyerId: buyer.id,
      amount: breakdown.total,
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
    const totalPaid = round2(dispatches.reduce((s, d) => s + d.paidAmount, 0));
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

  private async sellFromTank(
    farmId: string,
    userId: string,
    volumeL: number,
    buyerName: string,
  ): Promise<boolean> {
    if (volumeL <= 0) return false;
    // Sell from the fullest SELLABLE tank so the dispatch draws from where the
    // milk actually is (and never an empty tank when several exist).
    const tank = await this.prisma.milkTank.findFirst({
      where: { farmId, tankType: MilkTankType.SELLABLE, isActive: true },
      orderBy: { currentVolumeL: 'desc' },
    });
    if (!tank) return false;
    try {
      await this.milkTankService.adjustVolume(farmId, userId, tank.id, {
        delta: -volumeL,
        activityType: MilkTankActivity.SALE,
        source: 'milk_dispatch',
        notes: `Dispatch to ${buyerName}`,
      });
      return true;
    } catch (error) {
      this.log.warn('Sale tank adjustment skipped', {
        farmId,
        volumeL,
        reason: (error as Error).message,
      });
      return false;
    }
  }

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
