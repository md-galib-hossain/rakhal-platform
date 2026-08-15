import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedGridSourceType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FeedDistributionService } from './feed-distribution.service';
import { FeedStockService } from './feed-stock.service';
import { SaveFeedDraftDto } from '../../presentation/dto/save-feed-draft.dto';
import { ConfirmFeedDraftDto } from '../../presentation/dto/confirm-feed-draft.dto';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Feeding Grid (2026-08-15) — replaces Quick Feed. A per-cow, spreadsheet-style feeding session:
 * a farmer opens the grid for a day (optionally scoped to one feed group), sees every cow with its
 * carried-forward default quantity (yesterday's confirmed per-head value, regardless of which exact
 * prior date it came from), edits freely with auto-saved drafts (`FeedFeedingDraft`, zero inventory
 * effect), then "Confirm" turns the day's quantities into one real `FeedDistribution` (+ one
 * aggregate `FeedDistributionItem` line, matching the old `quickFeed()`'s single-line shape) with a
 * `FeedDistributionCattleItem` per cow, and decrements the named `FeedItem`/`FeedStock` source.
 */
@Injectable()
export class FeedFeedingGridService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly feedDistribution: FeedDistributionService,
    private readonly feedStock: FeedStockService,
  ) {
    this.log = logger.setContext(FeedFeedingGridService.name);
  }

  async getGrid(farmId: string, date: string, feedGroupId?: string) {
    if (feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: feedGroupId, farmId, isActive: true },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Feed group not found');
    }

    const logDate = this.dayStart(date);
    const cattle = await this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        ...(feedGroupId ? { feedGroupId } : {}),
      },
      select: { id: true, name: true, tagNumber: true, feedGroupId: true },
      orderBy: { tagNumber: 'asc' },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      return { date: date, feed_group_id: feedGroupId ?? null, cows: [] };
    }

    const [drafts, defaults] = await Promise.all([
      this.prisma.feedFeedingDraft.findMany({
        where: { farmId, cattleId: { in: cattleIds }, logDate },
      }),
      this.computeDefaults(farmId, cattleIds),
    ]);
    const draftsByCattle = this.groupByCattle(drafts);

    return {
      date,
      feed_group_id: feedGroupId ?? null,
      cows: cattle.map((c) => ({
        cattle_id: c.id,
        name: c.name,
        tag_number: c.tagNumber,
        feed_group_id: c.feedGroupId,
        drafts: (draftsByCattle.get(c.id) ?? []).map((d) => this.mapDraft(d)),
        default_quantity_kg: defaults.get(c.id) ?? null,
      })),
    };
  }

  /**
   * Auto-save a day's per-cow quantities for one `{date, sourceType, feedItemId|feedStockId}`
   * key. No `@@unique` in the schema (Postgres can't enforce uniqueness across two mutually
   * exclusive nullable FK columns — see `FeedFeedingDraft`'s doc comment), so uniqueness is
   * enforced here: each entry does a `findFirst` scoped on every one of
   * `farmId/cattleId/logDate/sourceType/feedItemId/feedStockId` and updates that row if found,
   * otherwise creates a new one.
   */
  async saveDraft(farmId: string, userId: string, dto: SaveFeedDraftDto) {
    await this.validateSource(farmId, dto.sourceType, dto);
    const logDate = this.dayStart(dto.date);
    const cattleIds = dto.entries.map((e) => e.cattleId);
    await this.assertCattleBelongToFarm(farmId, cattleIds);

    const feedItemId = dto.feedItemId ?? null;
    const feedStockId = dto.feedStockId ?? null;

    const saved = await this.prisma.$transaction(async (tx) => {
      const rows: Prisma.FeedFeedingDraftGetPayload<object>[] = [];
      for (const entry of dto.entries) {
        const existing = await tx.feedFeedingDraft.findFirst({
          where: {
            farmId,
            cattleId: entry.cattleId,
            logDate,
            sourceType: dto.sourceType,
            feedItemId,
            feedStockId,
          },
        });
        const row = existing
          ? await tx.feedFeedingDraft.update({
              where: { id: existing.id },
              data: { quantityKg: round2(entry.quantityKg) },
            })
          : await tx.feedFeedingDraft.create({
              data: {
                farmId,
                cattleId: entry.cattleId,
                feedGroupId: dto.feedGroupId,
                logDate,
                sourceType: dto.sourceType,
                feedItemId,
                feedStockId,
                quantityKg: round2(entry.quantityKg),
                createdBy: userId,
              },
            });
        rows.push(row);
      }
      return rows;
    });

    this.log.info('Feeding grid draft saved', {
      farmId,
      date: dto.date,
      sourceType: dto.sourceType,
      entries: saved.length,
    });
    return { saved: saved.length, drafts: saved.map((d) => this.mapDraft(d)) };
  }

  /**
   * Turn a day's feeding-grid quantities into one real `FeedDistribution`. Cow scope is always the
   * full grid for `{feedGroupId}` (or the whole active herd if `feedGroupId` is omitted) — matching
   * `getGrid()` — so a confirm with no draft and no `entries` still resolves a quantity per cow via
   * the same carried-forward default `getGrid()` shows. Per cow, effective quantity is:
   * `dto.entries` value (if that cow is named) → else an existing draft for this
   * `date+sourceType+source` → else the carried-forward default. Cows that resolve to 0/undeterminable
   * are skipped entirely (never added to the aggregate or the per-cow breakdown).
   */
  async confirm(farmId: string, userId: string, dto: ConfirmFeedDraftDto) {
    await this.validateSource(farmId, dto.sourceType, dto);
    if (dto.feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: dto.feedGroupId, farmId, isActive: true },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Feed group not found');
    }

    const logDate = this.dayStart(dto.date);
    const cattle = await this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        ...(dto.feedGroupId ? { feedGroupId: dto.feedGroupId } : {}),
      },
      select: { id: true },
    });
    const cattleIds = cattle.map((c) => c.id);
    if (cattleIds.length === 0) {
      throw new BadRequestException(
        'No cattle in scope to confirm feeding for',
      );
    }

    const feedItemId = dto.feedItemId ?? null;
    const feedStockId = dto.feedStockId ?? null;

    const entriesMap = new Map(
      (dto.entries ?? []).map((e) => [e.cattleId, e.quantityKg]),
    );
    const [drafts, defaults] = await Promise.all([
      this.prisma.feedFeedingDraft.findMany({
        where: {
          farmId,
          cattleId: { in: cattleIds },
          logDate,
          sourceType: dto.sourceType,
          feedItemId,
          feedStockId,
        },
      }),
      this.computeDefaults(farmId, cattleIds),
    ]);
    const draftMap = new Map(drafts.map((d) => [d.cattleId, d.quantityKg]));

    const lines = cattleIds
      .map((cattleId) => {
        const qty =
          entriesMap.get(cattleId) ??
          draftMap.get(cattleId) ??
          defaults.get(cattleId) ??
          0;
        return { cattleId, quantityKg: round2(qty) };
      })
      .filter((l) => l.quantityKg > 0);

    if (lines.length === 0) {
      throw new BadRequestException(
        'No determinable quantity for any cow in scope',
      );
    }
    const totalKg = round2(lines.reduce((sum, l) => sum + l.quantityKg, 0));

    // Resolve the aggregate ingredient line + validate stock BEFORE the transaction — same
    // "fail fast before creating the distribution row" pattern `create()`/`assertSufficientStock`
    // use elsewhere in this module.
    let ingredientId: string;
    let ingredientName: string;
    let pricePerKg: number;
    let applyDecrement: (tx: Prisma.TransactionClient) => Promise<void>;
    let postCommit: (distributionId: string) => Promise<void>;

    if (dto.sourceType === 'FEED_ITEM') {
      const usage = await this.feedDistribution.computeFeedItemUsage(
        farmId,
        dto.feedItemId!,
        totalKg,
      );
      ingredientId = usage.ingredientId;
      ingredientName = usage.ingredientName;
      pricePerKg = usage.pricePerKg;
      applyDecrement = async (tx) => {
        await tx.feedItem.update({
          where: { id: usage.feedItem.id },
          data: { currentStock: usage.newStock },
        });
      };
      postCommit = async () => {};
    } else {
      const stock = await this.prisma.feedStock.findFirst({
        where: { id: dto.feedStockId, farmId, isActive: true },
      });
      if (!stock) throw new NotFoundException('Feed stock lot not found');
      await this.feedStock.assertSufficientStock(farmId, [
        { stockId: stock.id, quantity: totalKg },
      ]);
      ingredientId = stock.sourceConcentrationId;
      ingredientName = `Batch ${stock.id}`;
      pricePerKg =
        stock.producedQtyKg > 0
          ? round2(stock.producedCostTk / stock.producedQtyKg)
          : 0;
      applyDecrement = async () => {};
      postCommit = async (distributionId: string) => {
        await this.feedStock.decrementForDistribution(farmId, userId, {
          stockId: stock.id,
          quantity: totalKg,
          distributionId,
        });
      };
    }

    const lineCost = round2(totalKg * pricePerKg);
    const targetFields = dto.feedGroupId
      ? { feedGroupId: dto.feedGroupId, cattleId: null }
      : { feedGroupId: null, cattleId: null };

    const created = await this.prisma.$transaction(async (tx) => {
      const dist = await tx.feedDistribution.create({
        data: {
          farmId,
          concentrationId: null,
          sourceType: 'FEEDING_GRID',
          ...targetFields,
          distributedAt: logDate,
          totalPlannedKg: totalKg,
          totalActualKg: totalKg,
          totalRefusalKg: 0,
          totalPlannedCost: lineCost,
          totalActualCost: lineCost,
          createdBy: userId,
          items: {
            create: [
              {
                ingredientId,
                ingredientName,
                plannedKg: totalKg,
                actualKg: totalKg,
                refusalKg: 0,
                pricePerKg,
                lineCost,
              },
            ],
          },
          cattleItems: {
            create: lines.map((l) => ({
              cattleId: l.cattleId,
              quantityKg: l.quantityKg,
            })),
          },
        },
        include: { items: true, cattleItems: true },
      });
      await applyDecrement(tx);
      await tx.feedFeedingDraft.deleteMany({
        where: {
          farmId,
          logDate,
          sourceType: dto.sourceType,
          feedItemId,
          feedStockId,
          cattleId: { in: lines.map((l) => l.cattleId) },
        },
      });
      return dist;
    });

    await postCommit(created.id);

    this.log.info('Feeding grid confirmed', {
      farmId,
      distributionId: created.id,
      date: dto.date,
      sourceType: dto.sourceType,
      cows: lines.length,
      totalKg,
    });

    return {
      id: created.id,
      date: dto.date,
      feed_group_id: dto.feedGroupId ?? null,
      source_type: dto.sourceType,
      feed_item_id: dto.feedItemId ?? null,
      feed_stock_id: dto.feedStockId ?? null,
      total_actual_kg: created.totalActualKg,
      total_actual_cost: created.totalActualCost,
      cows: created.cattleItems.map((c) => ({
        cattle_id: c.cattleId,
        quantity_kg: c.quantityKg,
      })),
    };
  }

  // ---- internals ------------------------------------------------------------

  private async validateSource(
    farmId: string,
    sourceType: FeedGridSourceType,
    dto: { feedItemId?: string; feedStockId?: string },
  ) {
    if (sourceType === 'FEED_ITEM') {
      const item = await this.prisma.feedItem.findFirst({
        where: { id: dto.feedItemId, farmId, isActive: true },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Feed item not found');
    } else {
      const stock = await this.prisma.feedStock.findFirst({
        where: { id: dto.feedStockId, farmId, isActive: true },
        select: { id: true },
      });
      if (!stock) throw new NotFoundException('Feed stock lot not found');
    }
  }

  private async assertCattleBelongToFarm(farmId: string, cattleIds: string[]) {
    const ids = [...new Set(cattleIds)];
    const found = await this.prisma.cattle.count({
      where: { id: { in: ids }, farmId, isActive: true },
    });
    if (found !== ids.length) {
      throw new BadRequestException(
        'One or more cattle do not belong to this farm',
      );
    }
  }

  /**
   * "Yesterday's per-head value carries forward as today's default" — the most recent confirmed
   * `FeedDistributionCattleItem` per cow, regardless of which exact prior date it was logged on.
   * Fetched once per `cattleIds` batch and reduced in JS to the first (most recent, thanks to the
   * `distributedAt desc` ordering) row per cow — simpler and safer than relying on Prisma's
   * relation-ordered `distinct` for a modest per-farm herd size.
   */
  private async computeDefaults(
    farmId: string,
    cattleIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        distribution: { farmId },
      },
      select: {
        cattleId: true,
        quantityKg: true,
        distribution: { select: { distributedAt: true } },
      },
      orderBy: { distribution: { distributedAt: 'desc' } },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!map.has(row.cattleId)) map.set(row.cattleId, row.quantityKg);
    }
    return map;
  }

  private groupByCattle<T extends { cattleId: string }>(
    rows: T[],
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.cattleId) ?? [];
      list.push(row);
      map.set(row.cattleId, list);
    }
    return map;
  }

  private mapDraft(row: {
    id: string;
    sourceType: FeedGridSourceType;
    feedItemId: string | null;
    feedStockId: string | null;
    quantityKg: number;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      source_type: row.sourceType,
      feed_item_id: row.feedItemId,
      feed_stock_id: row.feedStockId,
      quantity_kg: row.quantityKg,
      updated_at: row.updatedAt,
    };
  }

  private dayStart(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }
}
