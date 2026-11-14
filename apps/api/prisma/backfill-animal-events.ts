/**
 * RAKHAL-479: idempotent back-fill of one `AnimalEvent` header per existing
 * detail row (docs/epic-events-core/04-event-model-and-flows.md §7).
 *
 * New rows get their header from the `animal_event_sync` DB trigger (migration
 * `20261029100000_rakhal_479_animal_event_links`); this script covers rows that
 * pre-date it. Header ids are deterministic (`bf_<table>_<detailId>`), so a
 * second run finds nothing to do and creates 0 rows.
 *
 *   npx ts-node -r tsconfig-paths/register prisma/backfill-animal-events.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register prisma/backfill-animal-events.ts
 *
 * Provenance: HISTORICAL for PregnancyDiagnosis.method = PURCHASE_INTAKE and for
 * CalvingEvents whose Lactation is `isEstimated`; everything else RECORDED.
 * Voided rows (BreedingEvent / TreatmentLog `voidedAt`) become VOIDED.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

interface Spec {
  table: string;
  type: string;
  cattleCol: string;
  dateCol: string;
  recorderCol?: string;
  voidCol?: string;
  /** SQL boolean over alias `d` marking HISTORICAL provenance. */
  historicalSql?: string;
}

const SPECS: Spec[] = [
  {
    table: 'HeatEvent',
    type: 'HEAT',
    cattleCol: 'cattleId',
    dateCol: 'heatDateTime',
  },
  {
    table: 'BreedingEvent',
    type: 'BREEDING',
    cattleCol: 'cattleId',
    dateCol: 'breedingDate',
    voidCol: 'voidedAt',
  },
  {
    table: 'PregnancyDiagnosis',
    type: 'PREG_CHECK',
    cattleCol: 'cattleId',
    dateCol: 'diagnosisDate',
    historicalSql: `d."diagnosisMethod"::text = 'PURCHASE_INTAKE'`,
  },
  {
    table: 'CalvingEvent',
    type: 'CALVING',
    cattleCol: 'cattleId',
    dateCol: 'calvingDate',
    historicalSql: `EXISTS (SELECT 1 FROM "Lactation" l WHERE l."calvingEventId" = d.id AND l."isEstimated")`,
  },
  {
    table: 'AbortionEvent',
    type: 'ABORTION',
    cattleCol: 'cattleId',
    dateCol: 'abortionDate',
  },
  {
    table: 'DryPeriod',
    type: 'DRY_OFF',
    cattleCol: 'cattleId',
    dateCol: 'startDate',
  },
  {
    table: 'WeightRecord',
    type: 'WEIGHT',
    cattleCol: 'cattleId',
    dateCol: 'recordedDate',
    recorderCol: 'recordedBy',
  },
  {
    table: 'CalfWeightRecord',
    type: 'WEIGHT',
    cattleCol: 'calfId',
    dateCol: 'measuredDate',
    recorderCol: 'recordedBy',
  },
  {
    table: 'BodyConditionScore',
    type: 'BCS',
    cattleCol: 'cattleId',
    dateCol: 'recordedDate',
    recorderCol: 'recordedBy',
  },
  {
    table: 'TreatmentLog',
    type: 'TREATMENT',
    cattleCol: 'cattleId',
    dateCol: 'administeredAt',
    recorderCol: 'administeredBy',
    voidCol: 'voidedAt',
  },
  {
    table: 'CattleDisposition',
    type: 'DISPOSITION',
    cattleCol: 'cattleId',
    dateCol: 'date',
    recorderCol: 'createdById',
  },
  {
    table: 'MortalityRecord',
    type: 'DIED',
    cattleCol: 'cattleId',
    dateCol: 'deathDate',
    recorderCol: 'recordedBy',
  },
  {
    table: 'CalfWeaningRecord',
    type: 'WEANING',
    cattleCol: 'calfId',
    dateCol: 'weaningDate',
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const q = (s: string) => `"${s}"`;

async function count(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(rows[0].n);
}

type Snap = Record<string, { rows: number; linked: number }>;

async function snapshot(): Promise<Snap> {
  const out: Snap = {};
  for (const s of SPECS) {
    out[s.table] = {
      rows: await count(`SELECT count(*) n FROM ${q(s.table)}`),
      linked: await count(
        `SELECT count(*) n FROM ${q(s.table)} WHERE "animalEventId" IS NOT NULL`,
      ),
    };
  }
  return out;
}

function print(label: string, snap: Snap) {
  console.log(`\n${label}`);
  for (const [t, v] of Object.entries(snap)) {
    console.log(
      `  ${t.padEnd(20)} rows=${v.rows}  linked=${v.linked}  pending=${v.rows - v.linked}`,
    );
  }
}

async function backfill(s: Spec): Promise<number> {
  const idExpr = `'bf_${s.table.toLowerCase()}_' || d.id`;
  const typeExpr =
    s.type === 'DISPOSITION'
      ? `(CASE d."type"::text WHEN 'SALE' THEN 'SOLD' WHEN 'DEATH' THEN 'DIED' WHEN 'CULL' THEN 'CULLED' ELSE 'MOVE' END)::"AnimalEventType"`
      : `'${s.type}'::"AnimalEventType"`;
  const recorder = s.recorderCol
    ? `COALESCE(NULLIF(d.${q(s.recorderCol)}, ''), 'system')`
    : `'system'`;
  const voided = s.voidCol ? `d.${q(s.voidCol)}` : 'NULL::timestamp';
  const hist = s.historicalSql ?? 'false';
  const inserted = await prisma.$executeRawUnsafe(`
    INSERT INTO "AnimalEvent"
      (id, "farmId", "cattleId", type, "eventAt", provenance, status, "voidedAt", "recordedById", "createdAt", "updatedAt")
    SELECT ${idExpr}, c."farmId", c.id, ${typeExpr}, d.${q(s.dateCol)},
           (CASE WHEN ${hist} THEN 'HISTORICAL' ELSE 'RECORDED' END)::"EventProvenance",
           (CASE WHEN ${voided} IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END)::"EventStatus",
           ${voided}, ${recorder}, d."createdAt", now()
      FROM ${q(s.table)} d
      JOIN "Cattle" c ON c.id = d.${q(s.cattleCol)}
     WHERE d."animalEventId" IS NULL
    ON CONFLICT (id) DO NOTHING`);
  await prisma.$executeRawUnsafe(`
    UPDATE ${q(s.table)} d SET "animalEventId" = ${idExpr}
     WHERE d."animalEventId" IS NULL
       AND EXISTS (SELECT 1 FROM "AnimalEvent" e WHERE e.id = ${idExpr})`);
  return inserted;
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const before = await snapshot();
  print(dry ? 'DRY RUN: current state (nothing written)' : 'Before', before);
  const headersBefore = await count(`SELECT count(*) n FROM "AnimalEvent"`);
  console.log(`\nAnimalEvent headers before: ${headersBefore}`);
  if (dry) {
    const pending = Object.values(before).reduce(
      (a, v) => a + v.rows - v.linked,
      0,
    );
    console.log(`Would create up to ${pending} header(s).`);
    return;
  }
  let created = 0;
  for (const s of SPECS) {
    const n = await backfill(s);
    created += n;
    console.log(`  ${s.table.padEnd(20)} +${n} header(s)`);
  }
  print('After', await snapshot());
  const headersAfter = await count(`SELECT count(*) n FROM "AnimalEvent"`);
  console.log(
    `\nAnimalEvent headers after: ${headersAfter} (created ${created})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
