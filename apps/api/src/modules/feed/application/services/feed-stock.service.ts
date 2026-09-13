import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedConcentrationKind, NutritionSource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

const round2 = (v: number) => Math.round(v * 100) / 100;

/** RAKHAL-327: the batch-level nutrient snapshot `FeedStock` carries. Defaulted from the recipe's
 * computed totals at production time, farm-editable afterward via `updateNutrition`. */
export interface StockNutritionSnapshot {
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number;
  ndfPct: number;
  rdpPct: number;
  rupPct: number;
  starchPct: number;
  adfPct: number;
  calciumPct: number;
  phosphorusPct: number;
  tdnPct: number;
}

/**
 * Feed batch inventory (§12.5 follow-up — "TMR ↔ Inventory" real linkage, user request
 * 2026-07-17). Mirrors the Medicine/Semen "dedicated model + dedicated service + transactional
 * decrement + audit row" pattern (`MedicineService.decrementForTreatment`) rather than the
 * best-effort FK-matched `FeedItem` decrement `FeedDistributionService` already does — that path
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
      nutrition: StockNutritionSnapshot;
      kind: FeedConcentrationKind;
    },
    /** RAKHAL-423: pass the caller's own transaction so a finalize's batch-link decrements and
     * this production commit or roll back together, same shape `decrementForDistribution`
     * already uses. Opens its own transaction when omitted, so standalone callers are unchanged. */
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      const created = await client.feedStock.create({
        data: {
          farmId,
          kind: params.kind,
          sourceConcentrationId: params.concentrationId,
          sourceConcentrationVersion: params.version,
          producedAt: new Date(),
          producedQtyKg: round2(params.qtyKg),
          currentStockKg: round2(params.qtyKg),
          producedCostTk: round2(params.costTk),
          ...params.nutrition,
          createdBy: userId,
        },
      });
      await client.feedStockMovement.create({
        data: {
          stockId: created.id,
          changeKg: round2(params.qtyKg),
          reason: 'PRODUCED',
          createdBy: userId,
        },
      });
      return created;
    };
    const stock = tx
      ? await run(tx)
      : await this.prisma.$transaction((client) => run(client));

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
        where: { id: stockId, farmId, deletedAt: null },
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

  /**
   * Decrement a stock lot for a logged distribution (validated + audited, same shape as
   * `MedicineService.decrementForTreatment`).
   *
   * RD-036 fixed two separate races here:
   *
   * 1. **Lost updates.** This used to read `currentStockKg`, subtract in JavaScript, then write the
   *    result. Two concurrent distributions could both read 10, both write 5, and 10 kg of feed
   *    would leave the yard having decremented 5. The write is now a single conditional
   *    `updateMany` guarded on `currentStockKg >= quantity`, so the database itself rejects the
   *    second one — there is no read-modify-write window left to lose.
   * 2. **Split commits.** The caller used to create the distribution row in its own transaction and
   *    call this afterwards, so a failure here left a distribution logged against stock that never
   *    moved. Pass `tx` and the decrement joins the caller's transaction, committing or rolling
   *    back with it.
   *
   * Called without `tx` it still opens its own transaction, so the standalone callers are unchanged.
   */
  async decrementForDistribution(
    farmId: string,
    userId: string,
    opts: { stockId: string; quantity: number; distributionId?: string },
    tx?: Prisma.TransactionClient,
  ) {
    if (opts.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const run = async (client: Prisma.TransactionClient) => {
      // Conditional decrement: the `gte` guard is the concurrency control. `count === 0` means
      // either the lot is gone or somebody else got the stock first — both are worth telling the
      // caller apart, so the slow path only runs when we already know we are failing.
      const applied = await client.feedStock.updateMany({
        where: {
          id: opts.stockId,
          farmId,
          deletedAt: null,
          currentStockKg: { gte: opts.quantity },
        },
        data: { currentStockKg: { decrement: opts.quantity } },
      });

      if (applied.count === 0) {
        const stock = await client.feedStock.findFirst({
          where: { id: opts.stockId, farmId, deletedAt: null },
        });
        if (!stock) throw new NotFoundException('Feed stock lot not found');
        throw new BadRequestException(
          `Insufficient feed stock: ${stock.currentStockKg}kg available, ${opts.quantity}kg requested`,
        );
      }

      // `decrement` leaves float noise (10 - 0.1 - 0.2 style); normalise to the 2dp this service
      // stores everywhere else. Inside the same transaction, so it cannot reintroduce a race.
      const after = await client.feedStock.findUniqueOrThrow({
        where: { id: opts.stockId },
      });
      const rounded = round2(after.currentStockKg);
      const settled =
        rounded === after.currentStockKg
          ? after
          : await client.feedStock.update({
              where: { id: opts.stockId },
              data: { currentStockKg: rounded },
            });

      await client.feedStockMovement.create({
        data: {
          stockId: opts.stockId,
          changeKg: round2(-opts.quantity),
          reason: 'FED',
          distributionId: opts.distributionId ?? null,
          createdBy: userId,
        },
      });
      return settled;
    };

    const updated = tx
      ? await run(tx)
      : await this.prisma.$transaction((client) => run(client));

    this.log.info('Feed stock decremented', {
      farmId,
      stockId: opts.stockId,
      quantity: opts.quantity,
      distributionId: opts.distributionId,
    });
    return this.mapStock(updated);
  }

  /** RAKHAL-327: let a farm correct a produced batch's nutrient snapshot once real data comes back
   * (e.g. a lab report), instead of it being permanently stuck at the recipe's on-paper values.
   * Every field optional/partial — updates only what's supplied. `nutritionSource` defaults to
   * `LAB` on this path (the whole point of calling this route is "I have better data now"); pass
   * it explicitly to record `MANUFACTURER`/`FARM_ESTIMATE` instead. */
  async updateNutrition(
    farmId: string,
    id: string,
    patch: Partial<StockNutritionSnapshot> & {
      nutritionSource?: NutritionSource;
      sourceRef?: string | null;
    },
  ) {
    const row = await this.prisma.feedStock.findFirst({
      where: { id, farmId },
    });
    if (!row) throw new NotFoundException('Feed stock lot not found');
    const updated = await this.prisma.feedStock.update({
      where: { id },
      data: {
        ...patch,
        nutritionSource: patch.nutritionSource ?? 'LAB',
      },
    });
    this.log.info('Feed stock nutrition snapshot updated', {
      farmId,
      stockId: id,
      nutritionSource: updated.nutritionSource,
    });
    return this.mapStock(updated);
  }

  async list(farmId: string, includeArchived = false) {
    const rows = await this.prisma.feedStock.findMany({
      where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
      orderBy: { producedAt: 'desc' },
    });
    return rows.map((r) => this.mapStock(r));
  }

  /** Soft-delete a stock lot (user request 2026-07-19 — "form inventory it can be also deleted"),
   * same archive-not-hard-delete convention as every other inventory model. Doesn't touch
   * `currentStockKg`/movements — an archived lot's history stays intact, it's just hidden from the
   * default `list()`. */
  async archive(farmId: string, id: string) {
    const row = await this.prisma.feedStock.findFirst({
      where: { id, farmId },
    });
    if (!row) throw new NotFoundException('Feed stock lot not found');
    const updated = await this.prisma.feedStock.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.log.info('Feed stock archived', { farmId, stockId: id });
    return this.mapStock(updated);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. Same shape as
   * `FeedConcentrationService.removeMany`. */
  async removeMany(
    farmId: string,
    ids: string[],
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.feedStock.updateMany({
      where: { farmId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.log.info('Feed stock bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    return { deleted: result.count };
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

  private mapStock(
    row: {
      id: string;
      kind: FeedConcentrationKind;
      sourceConcentrationId: string;
      sourceConcentrationVersion: number;
      producedAt: Date;
      producedQtyKg: number;
      currentStockKg: number;
      producedCostTk: number;
      createdAt: Date;
      sourceRef: string | null;
    } & StockNutritionSnapshot & { nutritionSource: NutritionSource },
  ) {
    return {
      id: row.id,
      kind: row.kind,
      source_concentration_id: row.sourceConcentrationId,
      source_concentration_version: row.sourceConcentrationVersion,
      produced_at: row.producedAt,
      produced_qty_kg: row.producedQtyKg,
      current_stock_kg: row.currentStockKg,
      produced_cost_tk: row.producedCostTk,
      created_at: row.createdAt,
      nutrition: {
        dm_pct: row.dmPct,
        cp_pct: row.cpPct,
        me_mj_per_kg_dm: row.meMjPerKgDm,
        fat_pct: row.fatPct,
        ndf_pct: row.ndfPct,
        rdp_pct: row.rdpPct,
        rup_pct: row.rupPct,
        starch_pct: row.starchPct,
        adf_pct: row.adfPct,
        calcium_pct: row.calciumPct,
        phosphorus_pct: row.phosphorusPct,
        tdn_pct: row.tdnPct,
      },
      nutrition_source: row.nutritionSource,
      source_ref: row.sourceRef,
    };
  }
}
