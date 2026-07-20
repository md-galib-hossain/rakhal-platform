import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedItem, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { computeStockStatus, StockStatus } from '../../domain/medicine-status';
import { CreateFeedItemDto } from '../../presentation/dto/create-feed-item.dto';
import { ListFeedItemQueryDto } from '../../presentation/dto/list-feed-item-query.dto';
import { UpdateFeedItemDto } from '../../presentation/dto/update-feed-item.dto';

/** A feed item row enriched with stock status and the kg equivalent of its stock. */
type PresentedFeedItem = FeedItem & {
  stockStatus: StockStatus;
  kgEquivalent: number | null;
};

/**
 * Inventory → Feed tab, "Purchased" view (PRD §15.3, RAKHAL-075). `farmId` is
 * supplied by the controller from the verified token context and every query
 * is scoped to it. Feed is the umbrella — this table holds every purchased
 * feed input (forage, concentrate, mineral, vitamin, additive), not forage
 * alone; `feedClass` carries the scientific classification.
 */
@Injectable()
export class FeedItemService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FeedItemService.name);
  }

  async create(
    farmId: string,
    userId: string,
    dto: CreateFeedItemDto,
  ): Promise<PresentedFeedItem> {
    try {
      const feedItem = await this.prisma.feedItem.create({
        data: {
          farmId,
          name: dto.name,
          feedClass: dto.feedClass,
          feedSubType: dto.feedSubType,
          category: dto.category,
          ingredientId: dto.ingredientId,
          unit: dto.unit,
          kgPerUnit: dto.kgPerUnit,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold ?? 0,
          moisturePct: dto.moisturePct,
          supplier: dto.supplier,
          purchaseDate: new Date(dto.purchaseDate),
          notes: dto.notes,
          createdBy: userId,
        },
      });

      await this.syncIngredientPrice(farmId, userId, feedItem);

      this.log.info('Feed item created', { feedItemId: feedItem.id, farmId });
      return this.present(feedItem);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Feed item already exists');
      }
      throw error;
    }
  }

  async findAll(
    farmId: string,
    query: ListFeedItemQueryDto,
  ): Promise<CursorPage<PresentedFeedItem>> {
    const where: Prisma.FeedItemWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.feedClass ? { feedClass: query.feedClass } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { supplier: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.feedItem.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((feedItem) => this.present(feedItem)),
      meta: page.meta,
    };
  }

  async findOne(farmId: string, id: string): Promise<PresentedFeedItem> {
    return this.present(await this.getOrThrow(farmId, id));
  }

  async update(
    farmId: string,
    userId: string,
    id: string,
    dto: UpdateFeedItemDto,
  ): Promise<PresentedFeedItem> {
    await this.getOrThrow(farmId, id);

    try {
      const feedItem = await this.prisma.feedItem.update({
        where: { id },
        data: {
          name: dto.name,
          feedClass: dto.feedClass,
          feedSubType: dto.feedSubType,
          category: dto.category,
          ingredientId: dto.ingredientId,
          unit: dto.unit,
          kgPerUnit: dto.kgPerUnit,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          lowStockThreshold: dto.lowStockThreshold,
          moisturePct: dto.moisturePct,
          supplier: dto.supplier,
          ...(dto.purchaseDate
            ? { purchaseDate: new Date(dto.purchaseDate) }
            : {}),
          notes: dto.notes,
        },
      });

      if (dto.costPerUnit != null || dto.kgPerUnit != null) {
        await this.syncIngredientPrice(farmId, userId, feedItem);
      }

      this.log.info('Feed item updated', { feedItemId: id, farmId });
      return this.present(feedItem);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Feed item already exists');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string): Promise<PresentedFeedItem> {
    await this.getOrThrow(farmId, id);
    const feedItem = await this.prisma.feedItem.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Feed item archived', { feedItemId: id, farmId });
    return this.present(feedItem);
  }

  async restore(farmId: string, id: string): Promise<PresentedFeedItem> {
    await this.getOrThrow(farmId, id);
    const feedItem = await this.prisma.feedItem.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Feed item restored', { feedItemId: id, farmId });
    return this.present(feedItem);
  }

  async remove(farmId: string, id: string): Promise<PresentedFeedItem> {
    return this.archive(farmId, id);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. */
  async removeMany(
    farmId: string,
    ids: string[],
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.feedItem.updateMany({
      where: { farmId, id: { in: ids }, isActive: true },
      data: { isActive: false },
    });
    this.log.info('Feed items bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    return { deleted: result.count };
  }

  private async getOrThrow(farmId: string, id: string): Promise<FeedItem> {
    const feedItem = await this.prisma.feedItem.findFirst({
      where: { id, farmId },
    });
    if (!feedItem) {
      throw new NotFoundException('Feed item not found');
    }
    return feedItem;
  }

  /**
   * PRD §15.3 — "updating forage stock price refreshes Feed Formulator costs".
   * A feed item's purchased price is a farm-specific override on its linked
   * `FeedIngredient`, so a price/unit-conversion change here is expressed as
   * `FeedIngredientOverride.customPricePerKg` — writes the Prisma row directly
   * (the feed-module pattern for this kind of loose cross-module linkage,
   * mirroring `FeedDistributionService` reading `FeedItem`/`FeedIngredient`
   * directly; importing `FeedModule` here would create a module cycle via
   * `MilkModule`, which already imports `InventoryModule` and is itself
   * imported by `FeedModule`).
   * Only `customPricePerKg` is touched — never wipes a farm's existing
   * nutrition override on the same row. Best-effort: a missing link or an
   * un-computable per-kg price (non-kg unit with no `kgPerUnit`) is skipped,
   * not thrown. A `kg`-unit item needs no conversion factor at all — its
   * `costPerUnit` already *is* a per-kg price.
   */
  private async syncIngredientPrice(
    farmId: string,
    userId: string,
    feedItem: FeedItem,
  ): Promise<void> {
    if (!feedItem.ingredientId) return;
    const isKg = feedItem.unit.trim().toLowerCase() === 'kg';
    if (!isKg && (!feedItem.kgPerUnit || feedItem.kgPerUnit <= 0)) return;

    const pricePerKg = isKg
      ? feedItem.costPerUnit
      : feedItem.costPerUnit / feedItem.kgPerUnit!;
    const ingredientId = feedItem.ingredientId;
    await this.prisma.feedIngredientOverride.upsert({
      where: { farmId_ingredientId: { farmId, ingredientId } },
      update: { customPricePerKg: pricePerKg },
      create: {
        farmId,
        ingredientId,
        createdBy: userId,
        customPricePerKg: pricePerKg,
      },
    });
    this.log.info('Feed ingredient price synced from feed item', {
      farmId,
      ingredientId,
    });
  }

  private present(feedItem: FeedItem): PresentedFeedItem {
    return {
      ...feedItem,
      stockStatus: computeStockStatus(
        feedItem.currentStock,
        feedItem.lowStockThreshold,
      ),
      kgEquivalent:
        feedItem.kgPerUnit != null
          ? feedItem.currentStock * feedItem.kgPerUnit
          : null,
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
