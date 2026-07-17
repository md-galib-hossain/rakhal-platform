import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Feed batch inventory (§12.5 follow-up — "TMR ↔ Inventory" real linkage, user request
 * 2026-07-17). Mirrors the Medicine/Semen "dedicated model + dedicated service + transactional
 * decrement + audit row" pattern (`MedicineService.decrementForTreatment`) rather than the
 * best-effort name-matched `Forage` decrement `FeedDistributionService` already does — that path
 * stays as-is for farms not using formal stock tracking (`FeedDistributionItem.stockId` is
 * optional).
 */
@Injectable()
export class FeedStockService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FeedStockService.name);
  }

  /** Produce a new stock lot from a just-finalized concentration (called from
   * `FeedConcentrationService.finalize` — one action produces both the frozen ingredient and the
   * stock lot). */
  async produceFromConcentration(
    farmId: string,
    userId: string,
    params: {
      concentrationId: string;
      version: number;
      qtyKg: number;
      costTk: number;
    },
  ) {
    const stock = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feedStock.create({
        data: {
          farmId,
          sourceConcentrationId: params.concentrationId,
          sourceConcentrationVersion: params.version,
          producedAt: new Date(),
          producedQtyKg: round2(params.qtyKg),
          currentStockKg: round2(params.qtyKg),
          producedCostTk: round2(params.costTk),
          createdBy: userId,
        },
      });
      await tx.feedStockMovement.create({
        data: {
          stockId: created.id,
          changeKg: round2(params.qtyKg),
          reason: 'PRODUCED',
          createdBy: userId,
        },
      });
      return created;
    });

    this.log.info('Feed stock produced', {
      farmId,
      stockId: stock.id,
      concentrationId: params.concentrationId,
      qtyKg: params.qtyKg,
    });
    return this.mapStock(stock);
  }

  /** Read-only sufficiency check for one or more stock lots — call before creating a distribution
   * that will decrement them, so a shortfall is caught before the distribution row exists rather
   * than after (narrows, doesn't eliminate, the gap between this check and the later decrement —
   * documented, not a full atomic cross-service transaction). */
  async assertSufficientStock(
    farmId: string,
    requests: { stockId: string; quantity: number }[],
  ) {
    for (const { stockId, quantity } of requests) {
      const stock = await this.prisma.feedStock.findFirst({
        where: { id: stockId, farmId },
      });
      if (!stock)
        throw new NotFoundException(`Feed stock lot ${stockId} not found`);
      if (quantity <= 0)
        throw new BadRequestException('Quantity must be positive');
      if (stock.currentStockKg < quantity) {
        throw new BadRequestException(
          `Insufficient feed stock: ${stock.currentStockKg}kg available, ${quantity}kg requested`,
        );
      }
    }
  }

  /** Decrement a stock lot for a logged distribution (validated + transactional + audited, same
   * shape as `MedicineService.decrementForTreatment`). */
  async decrementForDistribution(
    farmId: string,
    userId: string,
    opts: { stockId: string; quantity: number; distributionId?: string },
  ) {
    const stock = await this.prisma.feedStock.findFirst({
      where: { id: opts.stockId, farmId },
    });
    if (!stock) throw new NotFoundException('Feed stock lot not found');
    if (opts.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    if (stock.currentStockKg < opts.quantity) {
      throw new BadRequestException(
        `Insufficient feed stock: ${stock.currentStockKg}kg available, ${opts.quantity}kg requested`,
      );
    }

    const newStock = round2(stock.currentStockKg - opts.quantity);
    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.feedStock.update({
        where: { id: stock.id },
        data: { currentStockKg: newStock },
      });
      await tx.feedStockMovement.create({
        data: {
          stockId: stock.id,
          changeKg: round2(-opts.quantity),
          reason: 'FED',
          distributionId: opts.distributionId ?? null,
          createdBy: userId,
        },
      });
      return s;
    });

    this.log.info('Feed stock decremented', {
      farmId,
      stockId: stock.id,
      quantity: opts.quantity,
      distributionId: opts.distributionId,
    });
    return this.mapStock(updated);
  }

  async list(farmId: string) {
    const rows = await this.prisma.feedStock.findMany({
      where: { farmId },
      orderBy: { producedAt: 'desc' },
    });
    return rows.map((r) => this.mapStock(r));
  }

  async get(farmId: string, id: string) {
    const row = await this.prisma.feedStock.findFirst({
      where: { id, farmId },
      include: { movements: { orderBy: { createdAt: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Feed stock lot not found');
    return {
      ...this.mapStock(row),
      movements: row.movements.map((m) => ({
        id: m.id,
        change_kg: m.changeKg,
        reason: m.reason,
        distribution_id: m.distributionId,
        created_at: m.createdAt,
      })),
    };
  }

  private mapStock(row: {
    id: string;
    sourceConcentrationId: string;
    sourceConcentrationVersion: number;
    producedAt: Date;
    producedQtyKg: number;
    currentStockKg: number;
    producedCostTk: number;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      source_concentration_id: row.sourceConcentrationId,
      source_concentration_version: row.sourceConcentrationVersion,
      produced_at: row.producedAt,
      produced_qty_kg: row.producedQtyKg,
      current_stock_kg: row.currentStockKg,
      produced_cost_tk: row.producedCostTk,
      created_at: row.createdAt,
    };
  }
}
