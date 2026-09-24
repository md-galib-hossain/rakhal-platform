import { FeedClass, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';

/**
 * RAKHAL-449 (MILESTONE 26): specs that need a feed item with stock seed it as a product plus a real
 * lot (`FeedItemBatch` + its `NutritionProfile`), the shape production code now guarantees — never by
 * writing `FeedItem.currentStock` alone, which only worked through a self-heal RAKHAL-450 removes.
 * The legacy mirror columns are kept in step so pre-450 readers still agree.
 */
export interface FeedFixtureOptions {
  farmId: string;
  createdBy: string;
  name: string;
  unitId: string;
  feedClass?: FeedClass;
  /** Opening lot stock (default 0 — an item with an empty shelf still has its lot). */
  stock?: number;
  costPerUnit?: number;
  purchaseDate?: Date;
  batchCode?: string;
  ingredientId?: string;
  lowStockThreshold?: number;
  kgPerUnit?: number;
  nutrition?: { dmPct: number; cpPct: number; meMjPerKgDm: number };
}

export async function createFeedItemWithLot(
  prisma: PrismaService,
  opts: FeedFixtureOptions,
) {
  const stock = opts.stock ?? 0;
  const costPerUnit = opts.costPerUnit ?? 10;
  const purchaseDate = opts.purchaseDate ?? new Date();
  const nutrition = opts.nutrition ?? {
    dmPct: 88,
    cpPct: 9,
    meMjPerKgDm: 8.5,
  };

  const profile = await prisma.nutritionProfile.create({
    data: {
      farmId: opts.farmId,
      createdBy: opts.createdBy,
      nutritionSource: 'FARM_ESTIMATE',
      ...nutrition,
    },
  });
  const item = await prisma.feedItem.create({
    data: {
      farmId: opts.farmId,
      name: opts.name,
      feedClass: opts.feedClass ?? FeedClass.CONCENTRATE,
      unitId: opts.unitId,
      currentStock: stock,
      costPerUnit,
      purchaseDate,
      createdBy: opts.createdBy,
      defaultNutritionProfileId: profile.id,
      ...(opts.ingredientId ? { ingredientId: opts.ingredientId } : {}),
      ...(opts.lowStockThreshold !== undefined
        ? { lowStockThreshold: opts.lowStockThreshold }
        : {}),
      ...(opts.kgPerUnit !== undefined ? { kgPerUnit: opts.kgPerUnit } : {}),
    } satisfies Prisma.FeedItemUncheckedCreateInput,
  });
  const batch = await prisma.feedItemBatch.create({
    data: {
      feedItemId: item.id,
      farmId: opts.farmId,
      batchCode: opts.batchCode,
      currentStock: stock,
      costPerUnit,
      purchaseDate,
      nutritionProfileId: profile.id,
      createdBy: opts.createdBy,
    },
  });
  return { item, batch, profile };
}
