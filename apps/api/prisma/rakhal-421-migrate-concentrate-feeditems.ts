/**
 * RAKHAL-421 data migration (docs/EPIC_PREPARED_FEED.md §5, closes RD-080): moves every
 * RAKHAL-406-era (2026-08-28 to 2026-09-13) Concentrate Mixer batch off `FeedItem` and onto
 * `FeedStock` — the shape every finalize now produces going forward. Identifies a candidate row by
 * `feedClass: 'CONCENTRATE'` joined to a `FeedIngredient` with `sourceConcentrationId != null`
 * (RAKHAL-406's own promote-and-create pairing — the ingredient link is what proves a `FeedItem`
 * came from a Concentrate Mixer finalize, not a real purchased concentrate feed). Carries
 * `currentStock` → `currentStockKg`, `costPerUnit * currentStock` → `producedCostTk`,
 * `purchaseDate` → `producedAt`, and the ingredient's live nutrition as the frozen snapshot (best
 * available — these pre-RAKHAL-421 batches never had one of their own). Soft-deletes the source
 * `FeedItem` row rather than hard-deleting it, so anything that still references it (an old
 * `FeedDistribution` line, a purchase line) keeps resolving. Same shape of one-off problem
 * `prisma/cleanup-template-sourced-stock.ts` solved on 2026-07-19. Safe to run multiple times — a
 * `FeedItem` already soft-deleted by a prior run is excluded by the `deletedAt: null` filter.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const round2 = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const candidates = await prisma.feedItem.findMany({
    where: {
      deletedAt: null,
      feedClass: 'CONCENTRATE',
      ingredient: { sourceConcentrationId: { not: null } },
    },
    include: { ingredient: true },
  });
  console.log(
    `Found ${candidates.length} RAKHAL-406-era concentrate FeedItem row(s) to migrate.`,
  );
  if (candidates.length === 0) return;

  let migrated = 0;
  for (const item of candidates) {
    const ing = item.ingredient!;
    await prisma.$transaction(async (tx) => {
      const stock = await tx.feedStock.create({
        data: {
          farmId: item.farmId,
          kind: 'CONCENTRATE_TEMPLATE',
          sourceConcentrationId: ing.sourceConcentrationId!,
          sourceConcentrationVersion: ing.sourceConcentrationVersion ?? 1,
          producedAt: item.purchaseDate,
          producedQtyKg: round2(item.currentStock),
          currentStockKg: round2(item.currentStock),
          producedCostTk: round2(item.costPerUnit * item.currentStock),
          dmPct: ing.dmPct,
          cpPct: ing.cpPct,
          meMjPerKgDm: ing.meMjPerKgDm,
          fatPct: ing.fatPct ?? 0,
          ndfPct: ing.ndfPct ?? 0,
          rdpPct: ing.rdpPct ?? 0,
          rupPct: ing.rupPct ?? 0,
          starchPct: ing.starchPct ?? 0,
          adfPct: ing.adfPct ?? 0,
          calciumPct: ing.calciumPct ?? 0,
          phosphorusPct: ing.phosphorusPct ?? 0,
          tdnPct: ing.tdnPct ?? 0,
          nutritionSource: 'REFERENCE',
          sourceRef: `migrated from FeedItem ${item.id} (RAKHAL-421)`,
          createdBy: item.createdBy,
        },
      });
      await tx.feedStockMovement.create({
        data: {
          stockId: stock.id,
          changeKg: round2(item.currentStock),
          reason: 'PRODUCED',
          createdBy: item.createdBy,
        },
      });
      await tx.feedItem.update({
        where: { id: item.id },
        data: { deletedAt: new Date() },
      });
    });
    migrated++;
  }
  console.log(`Migrated ${migrated} FeedItem row(s) to FeedStock.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
