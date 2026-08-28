/**
 * One-off backfill for the `feed_taxonomy_unification` migration: links every
 * existing `FeedItem` (Prisma model, `@@map("Forage")`) row to its Feed
 * Formulator `FeedIngredient` counterpart by `ingredientId`, replacing the
 * lowercased-name match the app used to rely on at read time.
 *
 * Idempotent — only touches rows where `ingredientId` is still null, so a
 * re-run after new data has been created is a safe no-op for already-linked
 * rows. Run via `pnpm ts-node -r tsconfig-paths/register prisma/backfill-forage-ingredient.ts`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function pricePerKg(item: {
  unit: string;
  kgPerUnit: number | null;
  costPerUnit: number;
}): number {
  if (item.unit.trim().toLowerCase() === 'kg') return item.costPerUnit;
  if (item.kgPerUnit && item.kgPerUnit > 0) {
    return item.costPerUnit / item.kgPerUnit;
  }
  // No known kg conversion — best-effort fallback, flagged in the summary log
  // rather than thrown, since this is a one-time data migration, not a
  // request-time validation.
  return item.costPerUnit;
}

async function main() {
  const items = await prisma.feedItem.findMany({
    where: { ingredientId: null },
  });
  console.log(`Found ${items.length} feed item(s) with no ingredient link.`);

  let matched = 0;
  let created = 0;
  let uncomputablePrice = 0;

  for (const item of items) {
    const nameFilter = {
      equals: item.name.trim(),
      mode: 'insensitive' as const,
    };
    const candidate = await prisma.feedIngredient.findFirst({
      where: {
        nameEn: nameFilter,
        OR: [{ farmId: null }, { farmId: item.farmId }],
      },
      // Prefer the global catalogue over a same-named farm-owned row.
      orderBy: [{ farmId: 'asc' }],
    });

    if (candidate) {
      await prisma.feedItem.update({
        where: { id: item.id },
        data: { ingredientId: candidate.id },
      });
      matched += 1;
      continue;
    }

    const isKg = item.unit.trim().toLowerCase() === 'kg';
    if (!isKg && !(item.kgPerUnit && item.kgPerUnit > 0)) {
      uncomputablePrice += 1;
    }
    const dmPct = item.moisturePct != null ? 100 - item.moisturePct : 100;
    const ingredient = await prisma.feedIngredient.create({
      data: {
        farmId: item.farmId,
        nameEn: item.name,
        feedClass: item.feedClass,
        feedSubType: item.feedSubType,
        dmPct,
        cpPct: 0,
        meMjPerKgDm: 0,
        fatPct: 0,
        ndfPct: 0,
        currentPricePerKg: pricePerKg(item),
        isAvailableBd: true,
        isSystemDefault: false,
      },
    });
    await prisma.feedItem.update({
      where: { id: item.id },
      data: { ingredientId: ingredient.id },
    });
    created += 1;
  }

  console.log(
    `Backfill complete: ${matched} matched to an existing ingredient, ${created} new farm-owned ingredients created` +
      (uncomputablePrice > 0
        ? ` (${uncomputablePrice} with an unconverted per-kg price — no kgPerUnit, non-kg unit)`
        : ''),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
