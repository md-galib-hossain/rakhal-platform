/**
 * One-off backfill for the RAKHAL-327 batch-nutrition migration: the additive migration
 * (`20260814170000_rakhal_327_feedstock_nutrition_additive`) added 12 nullable nutrient columns
 * to `FeedStock` alongside the existing `producedCostTk` snapshot. This script fills every
 * existing row (produced before this feature existed) by re-running the same DM/CP back-
 * derivation `FeedConcentrationService.buildStockNutritionSnapshot` uses at finalize time,
 * against the source concentration's *current* ingredient lines and *current* effective
 * catalogue/override nutrition — not the exact historical values at production time (those were
 * never recorded, which is the whole reason this ticket exists). This is a best-effort
 * approximation for pre-existing rows, documented as such; every row this script touches keeps
 * `nutritionSource: REFERENCE` (the same default new rows get), so nothing here is mistaken for
 * measured data.
 *
 * If a row's source concentration or its items have since been deleted, the row is backfilled
 * with zeros (matches the farm-quick-add-ingredient "no known data" convention) rather than left
 * NULL, since the follow-up migration needs every row non-null.
 *
 * Run once, after the additive migration and before the follow-up finalize migration
 * (`20260814170100_rakhal_327_feedstock_nutrition_finalize`) makes the 12 columns required. Safe
 * to re-run (idempotent — rows that already have `dmPct` set are skipped).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  computeTotals,
  FormulaLine,
} from '../src/modules/feed/domain/formula-math';
import {
  resolveEffective,
  CatalogueIngredient,
  IngredientOverride,
} from '../src/modules/feed/domain/ingredient-resolver';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const zeroSnapshot = {
  dmPct: 0,
  cpPct: 0,
  meMjPerKgDm: 0,
  fatPct: 0,
  ndfPct: 0,
  rdpPct: 0,
  rupPct: 0,
  starchPct: 0,
  adfPct: 0,
  calciumPct: 0,
  phosphorusPct: 0,
  tdnPct: 0,
};

async function main() {
  // Raw query, not the typed client: the generated Prisma types reflect `schema.prisma`'s final
  // (NOT NULL) target shape for `dmPct`, but the DB is mid-migration (additive step only applied
  // so far) — the typed `findMany({ where: { dmPct: null } })` doesn't compile against that type.
  const nullRows = await prisma.$queryRaw<
    {
      id: string;
      farmId: string;
      sourceConcentrationId: string;
      producedQtyKg: number;
    }[]
  >`SELECT "id", "farmId", "sourceConcentrationId", "producedQtyKg" FROM "FeedStock" WHERE "dmPct" IS NULL`;
  const rows = nullRows;
  console.log(`Backfilling ${rows.length} FeedStock row(s)...`);

  let zeroed = 0;
  let computed = 0;

  for (const row of rows) {
    const items = await prisma.feedConcentrationItem.findMany({
      where: { concentrationId: row.sourceConcentrationId },
    });
    if (items.length === 0 || row.producedQtyKg <= 0) {
      await prisma.feedStock.update({
        where: { id: row.id },
        data: zeroSnapshot,
      });
      zeroed++;
      continue;
    }

    const ingredientIds = [...new Set(items.map((i) => i.ingredientId))];
    const [ingredients, overrides] = await Promise.all([
      prisma.feedIngredient.findMany({ where: { id: { in: ingredientIds } } }),
      prisma.feedIngredientOverride.findMany({
        where: { farmId: row.farmId, ingredientId: { in: ingredientIds } },
      }),
    ]);
    const overrideById = new Map(overrides.map((o) => [o.ingredientId, o]));
    const effById = new Map(
      ingredients.map((ing) => [
        ing.id,
        resolveEffective(
          ing as unknown as CatalogueIngredient,
          (overrideById.get(ing.id) as unknown as IngredientOverride) ?? null,
        ),
      ]),
    );
    const lines: FormulaLine[] = items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const { totals } = computeTotals(lines, effById);
    const totalAsFedKg = row.producedQtyKg;

    const pctOfDm = (kg: number) =>
      totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
    const pctOfCp = (kg: number) =>
      totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;

    await prisma.feedStock.update({
      where: { id: row.id },
      data: {
        dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
        cpPct: pctOfDm(totals.cp_kg),
        meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
        fatPct: pctOfDm(totals.fat_kg),
        ndfPct: pctOfDm(totals.ndf_kg),
        rdpPct: pctOfCp(totals.rdp_kg),
        rupPct: pctOfCp(totals.rup_kg),
        starchPct: pctOfDm(totals.starch_kg),
        adfPct: pctOfDm(totals.adf_kg),
        calciumPct: pctOfDm(totals.calcium_kg),
        phosphorusPct: pctOfDm(totals.phosphorus_kg),
        tdnPct: pctOfDm(totals.tdn_kg),
      },
    });
    computed++;
  }

  console.log(
    `Done. ${computed} row(s) backfilled from their source concentration, ${zeroed} zeroed (concentration/items no longer exist).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
