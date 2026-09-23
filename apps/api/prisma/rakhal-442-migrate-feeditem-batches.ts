/**
 * RAKHAL-442 (MILESTONE 26, docs/EPIC_FEED_NUTRITION_PROFILE.md) — one-off backfill for the additive
 * migration `20260923130000_rakhal_442_feed_nutrition_profile_batches`.
 *
 * Every existing `FeedItem` (table "Forage") becomes itself (catalogue) **plus exactly one**
 * `FeedItemBatch` carrying its current stock/cost/purchase date, **plus one** `NutritionProfile`
 * holding the nutrition it effectively has today (linked ingredient + the farm's override, merged
 * null-preserving — unlike `resolveEffective()` this does NOT coerce missing optional nutrients to 0,
 * since "not measured" must stay distinct from zero). The profile is also set as the item's
 * `defaultNutritionProfileId`. Existing stock movements and purchase lines are re-pointed at the batch.
 *
 * Idempotent: an item that already has a batch is skipped. `--dry-run` reports without writing.
 * Run once, after `prisma migrate deploy`:
 *   pnpm exec tsx prisma/rakhal-442-migrate-feeditem-batches.ts [--dry-run]
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  resolveEffective,
  CatalogueIngredient,
  IngredientOverride,
} from '../src/modules/feed/domain/ingredient-resolver';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DRY_RUN = process.argv.includes('--dry-run');
const pick = <T>(custom: T | null | undefined, standard: T | null): T | null =>
  custom === null || custom === undefined ? standard : custom;

async function main() {
  const items = await prisma.feedItem.findMany({
    where: { batches: { none: {} } },
    include: {
      ingredient: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Backfilling ${items.length} FeedItem row(s) that have no batch yet...`,
  );

  let fromCatalogue = 0;
  let fromQuickAdd = 0;
  let placeholder = 0;
  let moistureDisagreements = 0;
  let stockBefore = 0;
  let stockAfter = 0;
  let movementsRepointed = 0;
  let purchaseLinesRepointed = 0;

  for (const item of items) {
    stockBefore += item.currentStock;
    const ing = item.ingredient;
    const override = ing
      ? await prisma.feedIngredientOverride.findUnique({
          where: {
            farmId_ingredientId: { farmId: item.farmId, ingredientId: ing.id },
          },
        })
      : null;

    let values: {
      dmPct: number;
      cpPct: number;
      meMjPerKgDm: number;
      fatPct: number | null;
      ndfPct: number | null;
      adfPct: number | null;
      rdpPct: number | null;
      rupPct: number | null;
      starchPct: number | null;
      sugarsPct: number | null;
      calciumPct: number | null;
      phosphorusPct: number | null;
      tdnPct: number | null;
    };
    let source: 'REFERENCE' | 'MANUFACTURER' | 'LAB' | 'FARM_ESTIMATE';
    let note: string;

    if (ing) {
      source = resolveEffective(
        ing as unknown as CatalogueIngredient,
        override as unknown as IngredientOverride | null,
      ).nutritionSource;
      values = {
        dmPct: pick(override?.customDmPct, ing.dmPct) as number,
        cpPct: pick(override?.customCpPct, ing.cpPct) as number,
        meMjPerKgDm: pick(
          override?.customMeMjPerKgDm,
          ing.meMjPerKgDm,
        ) as number,
        fatPct: pick(override?.customFatPct, ing.fatPct),
        ndfPct: pick(override?.customNdfPct, ing.ndfPct),
        adfPct: pick(override?.customAdfPct, ing.adfPct),
        rdpPct: pick(override?.customRdpPct, ing.rdpPct),
        rupPct: pick(override?.customRupPct, ing.rupPct),
        starchPct: pick(override?.customStarchPct, ing.starchPct),
        sugarsPct: ing.sugarsPct,
        calciumPct: pick(override?.customCalciumPct, ing.calciumPct),
        phosphorusPct: pick(override?.customPhosphorusPct, ing.phosphorusPct),
        tdnPct: pick(override?.customTdnPct, ing.tdnPct),
      };
      if (ing.farmId) {
        fromQuickAdd++;
        note =
          'Backfilled from a farm quick-add ingredient — no measured nutrition, please review.';
      } else {
        fromCatalogue++;
        note = 'Backfilled from the linked Rakhal catalogue ingredient.';
      }
      if (
        item.moisturePct != null &&
        Math.abs(100 - values.dmPct - item.moisturePct) > 1
      ) {
        moistureDisagreements++;
        console.warn(
          `  moisture disagreement on ${item.id} "${item.name}": item moisture ${item.moisturePct}% vs catalogue DM ${values.dmPct}% — catalogue DM wins`,
        );
      }
    } else {
      placeholder++;
      source = 'FARM_ESTIMATE';
      note =
        'No linked ingredient at backfill time — placeholder values, please enter the real nutrition.';
      values = {
        dmPct: item.moisturePct != null ? 100 - item.moisturePct : 100,
        cpPct: 0,
        meMjPerKgDm: 0,
        fatPct: null,
        ndfPct: null,
        adfPct: null,
        rdpPct: null,
        rupPct: null,
        starchPct: null,
        sugarsPct: null,
        calciumPct: null,
        phosphorusPct: null,
        tdnPct: null,
      };
    }

    stockAfter += item.currentStock;
    if (DRY_RUN) continue;

    await prisma.$transaction(async (tx) => {
      const profile = await tx.nutritionProfile.create({
        data: {
          farmId: item.farmId,
          ...values,
          nutritionSource: source,
          note,
          copiedFromIngredientId: ing?.id ?? null,
          createdBy: item.createdBy,
        },
      });
      const batch = await tx.feedItemBatch.create({
        data: {
          feedItemId: item.id,
          farmId: item.farmId,
          currentStock: item.currentStock,
          costPerUnit: item.costPerUnit,
          purchaseDate: item.purchaseDate,
          nutritionProfileId: profile.id,
          deletedAt: item.deletedAt,
          createdBy: item.createdBy,
        },
      });
      await tx.feedItem.update({
        where: { id: item.id },
        data: { defaultNutritionProfileId: profile.id },
      });
      const movements = await tx.feedItemStockMovement.updateMany({
        where: { feedItemId: item.id, feedItemBatchId: null },
        data: { feedItemBatchId: batch.id },
      });
      const lines = await tx.purchaseLine.updateMany({
        where: { feedItemId: item.id, feedItemBatchId: null },
        data: { feedItemBatchId: batch.id },
      });
      movementsRepointed += movements.count;
      purchaseLinesRepointed += lines.count;
    });
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Done. ${items.length} item(s): ${fromCatalogue} from catalogue, ${fromQuickAdd} from farm quick-add (review), ${placeholder} placeholder (no ingredient). ` +
      `${moistureDisagreements} moisture disagreement(s). Stock before ${stockBefore} / batches ${stockAfter}. ` +
      `${movementsRepointed} movement row(s) and ${purchaseLinesRepointed} purchase line(s) re-pointed.`,
  );

  if (!DRY_RUN) {
    // Invariants (docs/EPIC_FEED_NUTRITION_PROFILE.md §7): exactly one batch per item, stock equal, no orphans.
    const [itemCount, batchAgg, itemAgg, orphanMovements, noBatch] =
      await Promise.all([
        prisma.feedItem.count(),
        prisma.feedItemBatch.aggregate({ _sum: { currentStock: true } }),
        prisma.feedItem.aggregate({ _sum: { currentStock: true } }),
        prisma.feedItemStockMovement.count({
          where: { feedItemBatchId: null },
        }),
        prisma.feedItem.count({ where: { batches: { none: {} } } }),
      ]);
    console.log(
      `Invariants: items=${itemCount}, items without a batch=${noBatch}, ` +
        `item stock=${itemAgg._sum.currentStock ?? 0} vs batch stock=${batchAgg._sum.currentStock ?? 0}, ` +
        `movement rows still without a batch=${orphanMovements}.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
