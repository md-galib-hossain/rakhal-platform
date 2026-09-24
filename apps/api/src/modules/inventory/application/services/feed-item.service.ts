import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedItem,
  FeedItemBatch,
  FeedItemStockMovementReason,
  NutritionProfile,
  Prisma,
  Unit,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { NutritionProfileService } from 'src/modules/feed/application/services/nutrition-profile.service';
import {
  moisturePctFromDm,
  NutritionValues,
  toNutritionValues,
} from 'src/modules/feed/domain/nutrition-profile';
import { computeStockStatus } from '../../domain/medicine-status';
import { resolveKgPerUnit } from './unit.service';
import { CreateFeedItemDto } from '../../presentation/dto/create-feed-item.dto';
import { CreateFeedItemBatchDto } from '../../presentation/dto/create-feed-item-batch.dto';
import { ListFeedItemQueryDto } from '../../presentation/dto/list-feed-item-query.dto';
import { UpdateFeedItemDto } from '../../presentation/dto/update-feed-item.dto';
import { UpdateFeedBatchNutritionDto } from '../../presentation/dto/update-feed-batch-nutrition.dto';
import { AdjustFeedItemStockDto } from '../../presentation/dto/adjust-feed-item-stock.dto';
import { NutritionInputDto } from '../../presentation/dto/nutrition-input.dto';
import { InventoryActivityService } from './inventory-activity.service';

type BatchWithProfile = FeedItemBatch & { nutritionProfile: NutritionProfile };

/** A feed item with its unit and its live (non-archived) lots in FIFO order. */
type FeedItemFull = FeedItem & { unit: Unit; batches: BatchWithProfile[] };

/** FIFO order: oldest purchase first, ties broken by creation time (MILESTONE 26 D6). */
const FIFO_ORDER: Prisma.FeedItemBatchOrderByWithRelationInput[] = [
  { purchaseDate: 'asc' },
  { createdAt: 'asc' },
];

const ITEM_INCLUDE = {
  unit: true,
  batches: {
    where: { deletedAt: null },
    orderBy: FIFO_ORDER,
    include: { nutritionProfile: true },
  },
} satisfies Prisma.FeedItemInclude;

/** One lot's share of a planned feeding (RAKHAL-446). */
export interface FeedDrawPiece {
  batchId: string;
  batchCode: string | null;
  nutritionProfileId: string;
  profile: NutritionProfile;
  quantityUnits: number;
  quantityKg: number;
  costPerUnit: number;
  costTk: number;
}

export interface FeedDrawPlan {
  feedItem: FeedItemFull;
  kgPerUnit: number;
  pieces: FeedDrawPiece[];
  /** Cost-weighted across the lots drawn — the real FIFO price, not the newest lot's. */
  pricePerKg: number;
}

/** Removes float noise from running stock totals. */
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Inventory → Feed tab, "Purchased" view (PRD §15.3, RAKHAL-075; MILESTONE 26 / RAKHAL-444, ADR-026).
 * `FeedItem` is the **product**; each purchase is a `FeedItemBatch` lot carrying its own stock, cost and
 * immutable `NutritionProfile`. Stock is consumed FIFO (`purchaseDate asc`), never blended.
 *
 * **Product-level summaries (RAKHAL-450):** the product row stores no stock, cost, purchase date or
 * moisture — the API presents `currentStock` (sum of lots), `costPerUnit` and `purchaseDate` (newest lot)
 * and `moisturePct` (100 − head lot's dry matter) as derived fields so existing list/table/form clients
 * keep working. A create/update body that still carries stock/cost/date acts on the lots.
 *
 * `farmId` comes from the verified token context; every query is scoped to it.
 */
@Injectable()
export class FeedItemService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly activity: InventoryActivityService,
    private readonly profiles: NutritionProfileService,
  ) {
    this.log = logger.setContext(FeedItemService.name);
  }

  async create(farmId: string, userId: string, dto: CreateFeedItemDto) {
    if (!dto.nutrition && !dto.ingredientId) {
      throw new BadRequestException(
        'Provide a nutrition profile or link a catalogue ingredient to copy it from',
      );
    }
    if (dto.ingredientId) await this.assertIngredientExists(dto.ingredientId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const profile = dto.nutrition
          ? await this.profiles.create(
              farmId,
              userId,
              this.profileInput(dto.nutrition),
              tx,
            )
          : await this.profiles.createFromIngredient(
              farmId,
              userId,
              dto.ingredientId!,
              tx,
            );

        const item = await tx.feedItem.create({
          data: {
            farmId,
            name: dto.name,
            feedClass: dto.feedClass,
            feedSubType: dto.feedSubType,
            ingredientId: dto.ingredientId,
            defaultNutritionProfileId: profile.id,
            unitId: dto.unitId,
            kgPerUnit: dto.kgPerUnit,
            lowStockThreshold: dto.lowStockThreshold ?? 0,
            supplier: dto.supplier,
            notes: dto.notes,
            createdBy: userId,
          },
        });
        await tx.feedItemBatch.create({
          data: {
            feedItemId: item.id,
            farmId,
            batchCode: dto.batchCode,
            currentStock: dto.currentStock,
            costPerUnit: dto.costPerUnit,
            purchaseDate: new Date(dto.purchaseDate),
            nutritionProfileId: profile.id,
            createdBy: userId,
          },
        });
        return tx.feedItem.findUniqueOrThrow({
          where: { id: item.id },
          include: ITEM_INCLUDE,
        });
      });

      await this.syncIngredientPrice(farmId, userId, created);
      this.log.info('Feed item created', { feedItemId: created.id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Feed Item Added',
        `Feed item "${created.name}" (${created.feedClass}) added — stock ${dto.currentStock} ${created.unit.symbol}.`,
      );
      return this.present(created);
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
  ): Promise<CursorPage<ReturnType<FeedItemService['present']>>> {
    const where: Prisma.FeedItemWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.feedClass ? { feedClass: query.feedClass } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { supplier: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.feedItem.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      include: ITEM_INCLUDE,
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((feedItem) => this.present(feedItem)),
      meta: page.meta,
    };
  }

  /** Detail: the list shape plus whether the head lot's copied nutrition has drifted from the catalogue. */
  async findOne(farmId: string, id: string) {
    const item = await this.getOrThrow(farmId, id);
    const head = this.headBatch(item.batches);
    const differs = head
      ? await this.profiles.differsFromCatalogue(farmId, head.nutritionProfile)
      : null;
    return { ...this.present(item), nutritionDiffersFromCatalogue: differs };
  }

  async update(
    farmId: string,
    userId: string,
    id: string,
    dto: UpdateFeedItemDto,
  ) {
    await this.getOrThrow(farmId, id);
    if (dto.ingredientId) await this.assertIngredientExists(dto.ingredientId);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.feedItem.update({
          where: { id },
          data: {
            name: dto.name,
            feedClass: dto.feedClass,
            feedSubType: dto.feedSubType,
            ingredientId: dto.ingredientId,
            unitId: dto.unitId,
            kgPerUnit: dto.kgPerUnit,
            lowStockThreshold: dto.lowStockThreshold,
            supplier: dto.supplier,
            notes: dto.notes,
          },
        });

        // Lot-level fields accepted on the product edit for the existing form: cost/date apply to the
        // newest lot, a stock figure becomes a delta against the lots' total.
        if (dto.costPerUnit != null || dto.purchaseDate) {
          const newest = await tx.feedItemBatch.findFirst({
            where: { feedItemId: id, deletedAt: null },
            orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
          });
          if (newest) {
            await tx.feedItemBatch.update({
              where: { id: newest.id },
              data: {
                ...(dto.costPerUnit != null
                  ? { costPerUnit: dto.costPerUnit }
                  : {}),
                ...(dto.purchaseDate
                  ? { purchaseDate: new Date(dto.purchaseDate) }
                  : {}),
              },
            });
          }
        }
        if (dto.currentStock != null) {
          const total = await this.batchTotal(tx, id);
          const delta = r6(dto.currentStock - total);
          if (delta !== 0) {
            await this.applyDelta(tx, farmId, userId, id, {
              delta,
              reason: FeedItemStockMovementReason.ADJUSTMENT,
              notes: 'Stock edited on the feed item',
            });
          }
        }
        return tx.feedItem.findUniqueOrThrow({
          where: { id },
          include: ITEM_INCLUDE,
        });
      });

      if (dto.costPerUnit != null || dto.kgPerUnit != null) {
        await this.syncIngredientPrice(farmId, userId, updated);
      }
      this.log.info('Feed item updated', { feedItemId: id, farmId });
      await this.activity.record(
        farmId,
        userId,
        'Feed Item Updated',
        `Feed item "${updated.name}" updated.`,
      );
      return this.present(updated);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Feed item already exists');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string, userId?: string) {
    await this.getOrThrow(farmId, id);
    const feedItem = await this.prisma.feedItem.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: ITEM_INCLUDE,
    });
    this.log.info('Feed item archived', { feedItemId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Feed Item Archived',
      `Feed item "${feedItem.name}" archived.`,
    );
    return this.present(feedItem);
  }

  async restore(farmId: string, id: string, userId?: string) {
    await this.getOrThrow(farmId, id);
    const feedItem = await this.prisma.feedItem.update({
      where: { id },
      data: { deletedAt: null },
      include: ITEM_INCLUDE,
    });
    this.log.info('Feed item restored', { feedItemId: id, farmId });
    await this.activity.record(
      farmId,
      userId,
      'Feed Item Restored',
      `Feed item "${feedItem.name}" restored.`,
    );
    return this.present(feedItem);
  }

  async remove(farmId: string, id: string, userId?: string) {
    return this.archive(farmId, id, userId);
  }

  /**
   * Restock: add a new lot to an existing product (MILESTONE 26 D2). Nutrition comes from, in order,
   * `nutrition` (typed), `copyFromIngredientId` (copied once), else the item's default profile. Typing
   * or copying new nutrition also becomes the item's default for the *next* restock.
   */
  async createBatch(
    farmId: string,
    userId: string,
    itemId: string,
    dto: CreateFeedItemBatchDto,
  ) {
    const { item: updated } = await this.prisma.$transaction((tx) =>
      this.createLotIn(tx, farmId, userId, itemId, dto),
    );

    await this.syncIngredientPrice(farmId, userId, updated);
    this.log.info('Feed item batch added', {
      feedItemId: itemId,
      farmId,
      stock: dto.currentStock,
    });
    await this.activity.record(
      farmId,
      userId,
      'Feed Item Restocked',
      `Feed item "${updated.name}" restocked with ${dto.currentStock} ${updated.unit.symbol}${dto.batchCode ? ` (lot ${dto.batchCode})` : ''}.`,
    );
    return this.present(updated);
  }

  /**
   * Same as `createBatch` for a caller that owns the transaction (RAKHAL-445: a purchase line restocks
   * a feed item as one atomic write with its `Purchase`/`Payable`/journal). Returns the new lot's id so
   * the `PurchaseLine` can record it and a void can debit exactly that lot. Mirrors
   * `MedicineService.createBatch(..., tx)`.
   */
  async createBatchInTx(
    farmId: string,
    userId: string,
    itemId: string,
    dto: CreateFeedItemBatchDto,
    tx: Prisma.TransactionClient,
  ): Promise<{ batchId: string }> {
    const { batchId, item } = await this.createLotIn(
      tx,
      farmId,
      userId,
      itemId,
      dto,
    );
    await this.syncIngredientPrice(farmId, userId, item, tx);
    return { batchId };
  }

  private async createLotIn(
    tx: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    itemId: string,
    dto: CreateFeedItemBatchDto,
  ): Promise<{ batchId: string; item: FeedItemFull }> {
    const item = await tx.feedItem.findFirst({
      where: { id: itemId, farmId },
      include: ITEM_INCLUDE,
    });
    if (!item) throw new NotFoundException('Feed item not found');
    if (item.deletedAt) {
      throw new BadRequestException('Cannot restock an archived feed item');
    }
    if (dto.copyFromIngredientId) {
      const found = await tx.feedIngredient.findUnique({
        where: { id: dto.copyFromIngredientId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException('Linked ingredient not found');
    }

    {
      let profileId: string | null = null;
      let makeDefault = false;
      if (dto.nutrition) {
        const p = await this.profiles.create(
          farmId,
          userId,
          this.profileInput(dto.nutrition),
          tx,
        );
        profileId = p.id;
        makeDefault = true;
      } else if (dto.copyFromIngredientId) {
        const p = await this.profiles.createFromIngredient(
          farmId,
          userId,
          dto.copyFromIngredientId,
          tx,
        );
        profileId = p.id;
        makeDefault = true;
      } else {
        const newest = await tx.feedItemBatch.findFirst({
          where: { feedItemId: itemId, deletedAt: null },
          orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
          select: { nutritionProfileId: true },
        });
        profileId =
          item.defaultNutritionProfileId ?? newest?.nutritionProfileId ?? null;
      }
      if (!profileId) {
        throw new BadRequestException(
          'This item has no nutrition profile yet — provide one for the new batch',
        );
      }

      const batch = await tx.feedItemBatch.create({
        data: {
          feedItemId: itemId,
          farmId,
          batchCode: dto.batchCode,
          currentStock: dto.currentStock,
          costPerUnit: dto.costPerUnit,
          purchaseDate: new Date(dto.purchaseDate),
          nutritionProfileId: profileId,
          notes: dto.notes,
          createdBy: userId,
        },
      });
      const total = await this.batchTotal(tx, itemId);
      if (dto.currentStock > 0) {
        await tx.feedItemStockMovement.create({
          data: {
            feedItemId: itemId,
            feedItemBatchId: batch.id,
            farmId,
            reason: FeedItemStockMovementReason.PURCHASE,
            delta: dto.currentStock,
            balanceAfter: total,
            notes: dto.batchCode ? `Restock, lot ${dto.batchCode}` : 'Restock',
            createdBy: userId,
          },
        });
      }
      if (makeDefault) {
        await tx.feedItem.update({
          where: { id: itemId },
          data: { defaultNutritionProfileId: profileId },
        });
      }
      return {
        batchId: batch.id,
        item: await tx.feedItem.findUniqueOrThrow({
          where: { id: itemId },
          include: ITEM_INCLUDE,
        }),
      };
    }
  }

  /**
   * Restores stock to the exact lots a sale drew from (RAKHAL-445; mirrors
   * `MedicineService.restoreForSaleVoid`): every `SALE` movement carrying this `saleLineId` is reversed
   * against its own lot, so a sale that split across lots comes back split the same way. A pre-batch
   * sale line has no lot-linked movement — falls back to crediting the newest lot.
   */
  async restoreForSaleVoid(
    farmId: string,
    userId: string,
    opts: {
      saleLineId: string;
      fallbackFeedItemId: string;
      fallbackQuantity: number;
      notes?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const drawn = await tx.feedItemStockMovement.findMany({
      where: {
        farmId,
        saleLineId: opts.saleLineId,
        reason: FeedItemStockMovementReason.SALE,
        feedItemBatchId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (drawn.length === 0) {
      await this.adjustStock(
        farmId,
        userId,
        opts.fallbackFeedItemId,
        {
          adjustment: opts.fallbackQuantity,
          reason: FeedItemStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
          saleLineId: opts.saleLineId,
        },
        tx,
      );
      return;
    }
    for (const movement of drawn) {
      await this.adjustStock(
        farmId,
        userId,
        movement.feedItemId,
        {
          adjustment: -movement.delta,
          reason: FeedItemStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
          saleLineId: opts.saleLineId,
          batchId: movement.feedItemBatchId!,
        },
        tx,
      );
    }
  }

  /**
   * RAKHAL-446: read-only FIFO plan for feeding `quantityKg` of this product — which lots would be
   * drawn, how much from each (in the item's own unit and in kg), each lot's real cost and nutrition
   * profile. Pass the caller's `tx` when there is one; without it a short transaction of its own is
   * opened. Throws when the stock can't cover it.
   */
  async previewDraw(
    farmId: string,
    itemId: string,
    quantityKg: number,
    tx?: Prisma.TransactionClient,
    pinBatchId?: string,
  ): Promise<FeedDrawPlan> {
    const run = async (client: Prisma.TransactionClient) => {
      const found = await client.feedItem.findFirst({
        where: { id: itemId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Feed item not found');
      const item = await client.feedItem.findUniqueOrThrow({
        where: { id: itemId },
        include: ITEM_INCLUDE,
      });

      const kgPerUnit = resolveKgPerUnit(item.unit, item.kgPerUnit);
      if (!kgPerUnit || kgPerUnit <= 0) {
        throw new BadRequestException(
          `${item.name} has no kg-per-unit conversion set for its ${item.unit.symbol} unit — set "Kg Per Unit" on the feed item before feeding it`,
        );
      }
      const unitsNeeded = r6(quantityKg / kgPerUnit);
      // RAKHAL-447: a recipe line pinned to one lot may draw from that lot only.
      const drawable = pinBatchId
        ? item.batches.filter((b) => b.id === pinBatchId)
        : item.batches;
      if (pinBatchId && drawable.length === 0) {
        throw new BadRequestException(
          `The pinned batch of ${item.name} no longer exists`,
        );
      }
      const available = r6(drawable.reduce((s, b) => s + b.currentStock, 0));
      if (unitsNeeded > available) {
        throw new BadRequestException(
          `Not enough ${item.name} in stock (${available} ${item.unit.symbol} available, ${Math.round(unitsNeeded * 100) / 100} needed)`,
        );
      }

      const pieces: FeedDrawPiece[] = [];
      let need = unitsNeeded;
      for (const batch of drawable) {
        if (need <= 0) break;
        const take = Math.min(batch.currentStock, need);
        if (take <= 0) continue;
        pieces.push({
          batchId: batch.id,
          batchCode: batch.batchCode,
          nutritionProfileId: batch.nutritionProfileId,
          profile: batch.nutritionProfile,
          quantityUnits: r6(take),
          quantityKg: r6(take * kgPerUnit),
          costPerUnit: batch.costPerUnit,
          costTk: r6(take * batch.costPerUnit),
        });
        need = r6(need - take);
      }
      const totalKg = r6(pieces.reduce((s, p) => s + p.quantityKg, 0));
      const totalCost = r6(pieces.reduce((s, p) => s + p.costTk, 0));
      return {
        feedItem: item,
        kgPerUnit,
        pieces,
        pricePerKg: totalKg > 0 ? r6(totalCost / totalKg) : 0,
      };
    };
    return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
  }

  /** RAKHAL-446: draws exactly `quantityUnits` from one named lot for a feeding (guarded — see `applyDelta`). */
  async applyFeedDraw(
    farmId: string,
    userId: string,
    itemId: string,
    opts: {
      batchId: string;
      quantityUnits: number;
      distributionId?: string;
      cattleItemId?: string;
      notes?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (opts.quantityUnits <= 0) return;
    await this.applyDelta(tx, farmId, userId, itemId, {
      delta: -opts.quantityUnits,
      reason: FeedItemStockMovementReason.DISTRIBUTION,
      notes: opts.notes,
      batchId: opts.batchId,
      feedDistributionId: opts.distributionId,
      feedDistributionCattleItemId: opts.cattleItemId,
    });
  }

  /**
   * RAKHAL-446: reverses a feeding against the exact lots it drew from (found through the movements'
   * `feedDistributionCattleItemId`). A feeding that predates lots has no such movement — falls back to
   * crediting `fallbackQuantityKg` (converted to units) to the newest lot.
   */
  async restoreFeedDraw(
    farmId: string,
    userId: string,
    opts: {
      cattleItemId: string;
      fallbackFeedItemId: string;
      fallbackQuantityKg: number;
      notes?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const drawn = await tx.feedItemStockMovement.findMany({
      where: {
        farmId,
        feedDistributionCattleItemId: opts.cattleItemId,
        reason: FeedItemStockMovementReason.DISTRIBUTION,
        feedItemBatchId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (drawn.length === 0) {
      const item = await tx.feedItem.findFirst({
        where: { id: opts.fallbackFeedItemId, farmId },
        include: { unit: true },
      });
      if (!item) throw new NotFoundException('Feed item not found');
      const kgPerUnit = resolveKgPerUnit(item.unit, item.kgPerUnit);
      if (!kgPerUnit || kgPerUnit <= 0) {
        throw new BadRequestException(
          `${item.name} has no kg-per-unit conversion — cannot restore its stock`,
        );
      }
      await this.adjustStock(
        farmId,
        userId,
        item.id,
        {
          adjustment: r6(opts.fallbackQuantityKg / kgPerUnit),
          reason: FeedItemStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
        },
        tx,
      );
      return;
    }
    for (const movement of drawn) {
      await this.adjustStock(
        farmId,
        userId,
        movement.feedItemId,
        {
          adjustment: -movement.delta,
          reason: FeedItemStockMovementReason.ADJUSTMENT,
          notes: opts.notes,
          batchId: movement.feedItemBatchId!,
        },
        tx,
      );
    }
  }

  /** Exact-match recall lookup: every live lot carrying this batch code, with its product. */
  async findByBatchCode(farmId: string, code: string) {
    const rows = await this.prisma.feedItemBatch.findMany({
      where: {
        farmId,
        deletedAt: null,
        batchCode: { equals: code.trim(), mode: 'insensitive' },
      },
      orderBy: FIFO_ORDER,
      include: {
        nutritionProfile: true,
        feedItem: { include: { unit: true } },
      },
    });
    return rows.map((b) => ({
      ...this.presentBatch(b),
      feedItem: {
        id: b.feedItem.id,
        name: b.feedItem.name,
        feedClass: b.feedItem.feedClass,
        unit: b.feedItem.unit,
        deletedAt: b.feedItem.deletedAt,
      },
    }));
  }

  async reviseBatchNutrition(
    farmId: string,
    userId: string,
    itemId: string,
    batchId: string,
    dto: UpdateFeedBatchNutritionDto,
  ) {
    await this.assertBatchBelongs(farmId, itemId, batchId);
    const input = this.profileInput(dto.nutrition);
    await this.profiles.reviseBatch(farmId, userId, batchId, {
      values: input.values,
      nutritionSource: input.nutritionSource,
      sourceRef: input.sourceRef,
      note: input.note,
      expectedUpdatedAt: dto.expectedUpdatedAt,
      makeDefault: dto.makeDefault,
    });
    return this.findOne(farmId, itemId);
  }

  async revertBatchNutrition(
    farmId: string,
    userId: string,
    itemId: string,
    batchId: string,
  ) {
    await this.assertBatchBelongs(farmId, itemId, batchId);
    await this.profiles.revertBatch(farmId, userId, batchId);
    return this.findOne(farmId, itemId);
  }

  async resyncBatchNutrition(
    farmId: string,
    userId: string,
    itemId: string,
    batchId: string,
  ) {
    await this.assertBatchBelongs(farmId, itemId, batchId);
    await this.profiles.resyncBatch(farmId, userId, batchId);
    return this.findOne(farmId, itemId);
  }

  /**
   * Apply a signed stock delta and record audit movement(s), atomically. A negative delta draws FIFO
   * across lots (one movement per lot touched); a positive one credits the newest lot; `dto.batchId`
   * pins it to one lot. Rejects anything that would drive a lot — or the item — below zero.
   * `tx` lets a caller fold this into its own transaction (RAKHAL-341) — mirrors
   * `milkTankService.adjustVolume`.
   */
  async adjustStock(
    farmId: string,
    userId: string,
    id: string,
    dto: AdjustFeedItemStockDto,
    tx?: Prisma.TransactionClient,
  ) {
    if (dto.adjustment === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }
    const run = async (client: Prisma.TransactionClient) => {
      const exists = await client.feedItem.findFirst({
        where: { id, farmId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Feed item not found');
      await this.applyDelta(client, farmId, userId, id, {
        delta: dto.adjustment,
        reason: dto.reason,
        notes: dto.notes,
        saleLineId: dto.saleLineId,
        batchId: dto.batchId,
      });
      return client.feedItem.findUniqueOrThrow({
        where: { id },
        include: ITEM_INCLUDE,
      });
    };

    const feedItem = tx
      ? await run(tx)
      : await this.prisma.$transaction((t) => run(t));

    const presented = this.present(feedItem);
    this.log.info('Feed item stock adjusted', {
      feedItemId: id,
      farmId,
      delta: dto.adjustment,
      balanceAfter: presented.currentStock,
    });
    return presented;
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — one `updateMany`, silently skipping any
   * id outside this farm or already inactive rather than erroring the whole batch. */
  async removeMany(
    farmId: string,
    ids: string[],
    userId?: string,
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.feedItem.updateMany({
      where: { farmId, id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.log.info('Feed items bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    if (result.count > 0) {
      await this.activity.record(
        farmId,
        userId,
        'Feed Items Bulk Archived',
        `${result.count} feed item(s) archived.`,
      );
    }
    return { deleted: result.count };
  }

  // ---------------------------------------------------------------------------------------------
  // Lot engine
  // ---------------------------------------------------------------------------------------------

  /** Moves stock on lots and writes one movement per lot touched. */
  private async applyDelta(
    tx: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    itemId: string,
    opts: {
      delta: number;
      reason: FeedItemStockMovementReason;
      notes?: string;
      saleLineId?: string;
      batchId?: string;
      feedDistributionId?: string;
      feedDistributionCattleItemId?: string;
    },
  ): Promise<void> {
    const batches = await tx.feedItemBatch.findMany({
      where: { feedItemId: itemId, deletedAt: null },
      orderBy: FIFO_ORDER,
    });
    let running = r6(batches.reduce((s, b) => s + b.currentStock, 0));

    const allocations: { batch: FeedItemBatch; delta: number }[] = [];
    if (opts.batchId) {
      const pinned = batches.find((b) => b.id === opts.batchId);
      if (!pinned) throw new NotFoundException('Feed batch not found');
      if (r6(pinned.currentStock + opts.delta) < 0) {
        throw new BadRequestException('Stock cannot go below zero');
      }
      allocations.push({ batch: pinned, delta: opts.delta });
    } else if (opts.delta > 0) {
      const newest = batches[batches.length - 1];
      if (!newest) {
        throw new BadRequestException(
          'This item has no batch to credit — restock it with a batch first',
        );
      }
      allocations.push({ batch: newest, delta: opts.delta });
    } else {
      let need = -opts.delta;
      if (r6(need - running) > 0) {
        throw new BadRequestException('Stock cannot go below zero');
      }
      for (const batch of batches) {
        if (need <= 0) break;
        const take = Math.min(batch.currentStock, need);
        if (take <= 0) continue;
        allocations.push({ batch, delta: -take });
        need = r6(need - take);
      }
    }

    for (const { batch, delta } of allocations) {
      // Guarded write: a concurrent decrement can't drive the lot negative.
      const moved = await tx.feedItemBatch.updateMany({
        where:
          delta < 0
            ? { id: batch.id, currentStock: { gte: -delta } }
            : { id: batch.id },
        data: { currentStock: { increment: delta } },
      });
      if (moved.count !== 1) {
        throw new ConflictException(
          'Stock changed while this was being applied — try again',
        );
      }
      running = r6(running + delta);
      await tx.feedItemStockMovement.create({
        data: {
          feedItemId: itemId,
          feedItemBatchId: batch.id,
          farmId,
          reason: opts.reason,
          delta: r6(delta),
          balanceAfter: running,
          notes: opts.notes,
          saleLineId: opts.saleLineId ?? null,
          feedDistributionId: opts.feedDistributionId ?? null,
          feedDistributionCattleItemId:
            opts.feedDistributionCattleItemId ?? null,
          createdBy: userId,
        },
      });
    }
  }

  private async batchTotal(
    tx: Prisma.TransactionClient,
    itemId: string,
  ): Promise<number> {
    const agg = await tx.feedItemBatch.aggregate({
      where: { feedItemId: itemId, deletedAt: null },
      _sum: { currentStock: true },
    });
    return r6(agg._sum.currentStock ?? 0);
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------

  private async getOrThrow(farmId: string, id: string): Promise<FeedItemFull> {
    const feedItem = await this.prisma.feedItem.findFirst({
      where: { id, farmId },
      include: ITEM_INCLUDE,
    });
    if (!feedItem) {
      throw new NotFoundException('Feed item not found');
    }
    return feedItem;
  }

  private async assertBatchBelongs(
    farmId: string,
    itemId: string,
    batchId: string,
  ): Promise<void> {
    const batch = await this.prisma.feedItemBatch.findFirst({
      where: { id: batchId, farmId, feedItemId: itemId },
      select: { id: true },
    });
    if (!batch) throw new NotFoundException('Feed batch not found');
  }

  private async assertIngredientExists(ingredientId: string): Promise<void> {
    const found = await this.prisma.feedIngredient.findUnique({
      where: { id: ingredientId },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('Linked ingredient not found');
  }

  /** The lot a UI/plan should treat as "current": oldest with stock (what FIFO would feed next), else newest. */
  private headBatch(batches: BatchWithProfile[]): BatchWithProfile | undefined {
    return (
      batches.find((b) => b.currentStock > 0) ?? batches[batches.length - 1]
    );
  }

  private profileInput(input: NutritionInputDto) {
    const values: NutritionValues = toNutritionValues(input);
    return {
      values,
      nutritionSource: input.nutritionSource,
      sourceRef: input.sourceRef ?? null,
      note: input.note ?? null,
    };
  }

  /**
   * PRD §15.3 — "updating forage stock price refreshes Feed Formulator costs".
   * A feed item's purchased price is a farm-specific override on its linked
   * `FeedIngredient`, so a price/unit-conversion change here is expressed as
   * `FeedIngredientOverride.customPricePerKg` — writes the Prisma row directly
   * (importing `FeedModule` here would create a module cycle via `MilkModule`).
   * MILESTONE 26 D8: the price is the **newest lot's** cost, and it
   * only runs when an ingredient is linked. Only `customPricePerKg` is touched — never wipes a farm's
   * existing nutrition override. Best-effort: an un-computable per-kg price is skipped, not thrown.
   */
  private async syncIngredientPrice(
    farmId: string,
    userId: string,
    feedItem: FeedItemFull,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    if (!feedItem.ingredientId) return;
    const kgPerUnit = resolveKgPerUnit(feedItem.unit, feedItem.kgPerUnit);
    if (!kgPerUnit || kgPerUnit <= 0) return;

    const newest = feedItem.batches[feedItem.batches.length - 1];
    if (!newest) return;
    const pricePerKg = newest.costPerUnit / kgPerUnit;
    const ingredientId = feedItem.ingredientId;
    await client.feedIngredientOverride.upsert({
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

  private presentProfile(profile: NutritionProfile) {
    return {
      id: profile.id,
      dmPct: profile.dmPct,
      cpPct: profile.cpPct,
      meMjPerKgDm: profile.meMjPerKgDm,
      fatPct: profile.fatPct,
      ndfPct: profile.ndfPct,
      adfPct: profile.adfPct,
      rdpPct: profile.rdpPct,
      rupPct: profile.rupPct,
      starchPct: profile.starchPct,
      sugarsPct: profile.sugarsPct,
      calciumPct: profile.calciumPct,
      phosphorusPct: profile.phosphorusPct,
      tdnPct: profile.tdnPct,
      moisturePct: moisturePctFromDm(profile.dmPct),
      nutritionSource: profile.nutritionSource,
      sourceRef: profile.sourceRef,
      note: profile.note,
      supersedesId: profile.supersedesId,
      copiedFromIngredientId: profile.copiedFromIngredientId,
      createdAt: profile.createdAt,
    };
  }

  private presentBatch(batch: BatchWithProfile) {
    return {
      id: batch.id,
      batchCode: batch.batchCode,
      currentStock: batch.currentStock,
      costPerUnit: batch.costPerUnit,
      purchaseDate: batch.purchaseDate,
      notes: batch.notes,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      nutritionProfileId: batch.nutritionProfileId,
      nutrition: this.presentProfile(batch.nutritionProfile),
    };
  }

  private present(feedItem: FeedItemFull) {
    const kgPerUnit = resolveKgPerUnit(feedItem.unit, feedItem.kgPerUnit);
    const head = this.headBatch(feedItem.batches);
    const { batches, ...rest } = feedItem;
    // Product-level summaries derived from the lots (RAKHAL-450: the product stores none of these):
    // total stock, and the newest lot's cost and purchase date.
    const currentStock = r6(batches.reduce((s, b) => s + b.currentStock, 0));
    const newest = batches[batches.length - 1];
    return {
      ...rest,
      currentStock,
      costPerUnit: newest?.costPerUnit ?? 0,
      purchaseDate: newest?.purchaseDate ?? feedItem.createdAt,
      // Moisture is derived from the head lot's dry matter (D5), never stored.
      moisturePct: head ? moisturePctFromDm(head.nutritionProfile.dmPct) : null,
      stockStatus: computeStockStatus(currentStock, feedItem.lowStockThreshold),
      kgEquivalent: kgPerUnit != null ? currentStock * kgPerUnit : null,
      nutrition: head ? this.presentProfile(head.nutritionProfile) : null,
      batches: batches.map((b) => this.presentBatch(b)),
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (error as { code?: string }).code === 'P2002';
  }
}
