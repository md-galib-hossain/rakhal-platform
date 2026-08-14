/**
 * One-off backfill for the Unit catalog migration (RAKHAL-326): the additive migration
 * (`20260814150000_rakhal_326_unit_catalog_additive`) added a nullable `unitId` column to
 * Medicine/Equipment/Forage(FeedItem) alongside their existing free-text `unit` column
 * (Prisma field `unitLabel`, same db column, transitional rename during this migration).
 * This script resolves every distinct `(farmId, trim(lower(unit)))` value across the 3
 * tables to a seeded system `Unit` (matched by symbol/name, case-insensitive) — or, if no
 * match exists, creates a farm-custom `Unit` row preserving the original label (`farmId` =
 * that item's farm) so no data/label is lost — then sets `unitId` on every row.
 *
 * Run once, after `pnpm seed` has populated the system units and before the follow-up
 * migration makes `Medicine.unitId`/`FeedItem.unitId` required and drops the legacy `unit`
 * column. Safe to re-run (idempotent: rows that already have a `unitId` are skipped; unit
 * lookups/creates are upsert-by-natural-key).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UnitDimension } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Row = { id: string; farmId: string; unitLabel: string | null };

/** Case-insensitive symbol/name aliases → the seeded system unit id (`seedUnits` in seed.ts). */
const SYSTEM_UNIT_ALIASES: Record<string, string> = {
  kg: 'unit_kg',
  kgs: 'unit_kg',
  kilogram: 'unit_kg',
  kilograms: 'unit_kg',
  g: 'unit_g',
  gram: 'unit_g',
  grams: 'unit_g',
  ton: 'unit_ton',
  tons: 'unit_ton',
  tonne: 'unit_ton',
  tonnes: 'unit_ton',
  l: 'unit_l',
  litre: 'unit_l',
  litres: 'unit_l',
  liter: 'unit_l',
  liters: 'unit_l',
  ml: 'unit_ml',
  millilitre: 'unit_ml',
  millilitres: 'unit_ml',
  milliliter: 'unit_ml',
  milliliters: 'unit_ml',
  pcs: 'unit_pcs',
  pc: 'unit_pcs',
  piece: 'unit_pcs',
  pieces: 'unit_pcs',
  unit: 'unit_pcs',
  units: 'unit_pcs',
  bag: 'unit_bag',
  bags: 'unit_bag',
  sack: 'unit_sack',
  sacks: 'unit_sack',
  bale: 'unit_bale',
  bales: 'unit_bale',
  box: 'unit_box',
  boxes: 'unit_box',
  bottle: 'unit_bottle',
  bottles: 'unit_bottle',
  dose: 'unit_dose',
  doses: 'unit_dose',
};

async function resolveUnitId(
  farmId: string,
  rawLabel: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${farmId}::${rawLabel.trim().toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const normalized = rawLabel.trim().toLowerCase();
  const systemId = SYSTEM_UNIT_ALIASES[normalized];
  if (systemId) {
    cache.set(key, systemId);
    return systemId;
  }

  // No system match — create (or reuse) a farm-custom Unit preserving the original label.
  // Farm-custom units have no natural unique key in the schema, so look up by
  // (farmId, symbol) in memory first to stay idempotent across a re-run within this script,
  // then fall back to a DB lookup in case a prior run already created it.
  const existing = await prisma.unit.findFirst({
    where: { farmId, symbol: rawLabel.trim(), isSystemDefault: false },
    select: { id: true },
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = await prisma.unit.create({
    data: {
      farmId,
      name: rawLabel.trim(),
      symbol: rawLabel.trim(),
      dimension: UnitDimension.COUNT, // unknown provenance — COUNT is the safe default (no conversion math assumed)
      conversionToBase: null,
      isSystemDefault: false,
      isActive: true,
    },
    select: { id: true },
  });
  cache.set(key, created.id);
  return created.id;
}

async function backfillModel(
  modelName: 'medicine' | 'equipment' | 'feedItem',
  cache: Map<string, string>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[modelName];
  const rows: Row[] = await delegate.findMany({
    where: { unitId: null },
    select: { id: true, farmId: true, unitLabel: true },
  });

  let updated = 0;
  for (const row of rows) {
    // Equipment.unitLabel is nullable — a row with no legacy label just stays unitId: null.
    if (!row.unitLabel || !row.unitLabel.trim()) continue;
    const unitId = await resolveUnitId(row.farmId, row.unitLabel, cache);
    await delegate.update({ where: { id: row.id }, data: { unitId } });
    updated += 1;
  }
  console.log(`✔ ${modelName}: backfilled ${updated}/${rows.length} row(s)`);
}

async function main(): Promise<void> {
  const cache = new Map<string, string>();
  await backfillModel('medicine', cache);
  await backfillModel('equipment', cache);
  await backfillModel('feedItem', cache);

  const remaining = await Promise.all([
    prisma.medicine.count({ where: { unitId: null } }),
    prisma.feedItem.count({ where: { unitId: null } }),
  ]);
  if (remaining[0] > 0 || remaining[1] > 0) {
    console.warn(
      `⚠ ${remaining[0]} Medicine + ${remaining[1]} FeedItem row(s) still have no unitId ` +
        '(empty/blank legacy label) — these need a manual unitId before the follow-up ' +
        'migration can make the column required.',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
