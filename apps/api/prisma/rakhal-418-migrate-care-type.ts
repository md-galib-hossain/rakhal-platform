/**
 * RAKHAL-418 data migration (step between the two hand-authored migrations —
 * `20260915120000_..._prepare` and `20260915130000_..._finalize`): backfills the new
 * `HealthCase.careType` (`HealthCareType`: CURATIVE | PREVENTIVE) from the old `diagnosisType`
 * column (`HealthDiagnosisType`, 8 values), which is still physically present in the database at
 * this point — the `prepare` migration only added `careType` alongside it, it did not drop
 * `diagnosisType` yet. `HealthCase.diagnosisType` was already removed from `schema.prisma` (this
 * ticket's own schema edit), so the generated Prisma Client no longer types it — read via
 * `$queryRaw` instead, same reasoning the `PREVENTIVE_DIAGNOSIS_TYPES` membership check itself
 * always used: a preventive-flavoured diagnosisType maps to PREVENTIVE, everything else (including
 * `OTHER`, e.g. Quick Treat's caseless-case default) maps to CURATIVE — this mirrors
 * `isPreventiveDiagnosisType()`'s own set exactly, not a new judgment call.
 *
 * Idempotent: only touches rows where `careType IS NULL`, so re-running after a partial failure
 * (or before the `finalize` migration makes the column NOT NULL) does no extra work. Same shape of
 * one-off problem `prisma/rakhal-415-migrate-preventive-cases.ts` (2026-09-15) already solved.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PREVENTIVE_DIAGNOSIS_TYPES = new Set([
  'VACCINATION',
  'PREVENTIVE',
  'DEWORMING',
  'ROUTINE_CHECKUP',
  'BREEDING_RELATED',
]);

async function main() {
  const rows = await prisma.$queryRaw<
    { id: string; diagnosisType: string }[]
  >`SELECT id, "diagnosisType" FROM "HealthCase" WHERE "careType" IS NULL`;

  console.log(
    `Found ${rows.length} HealthCase row(s) needing careType backfill.`,
  );
  if (rows.length === 0) return;

  let curative = 0;
  let preventive = 0;

  for (const row of rows) {
    const careType = PREVENTIVE_DIAGNOSIS_TYPES.has(row.diagnosisType)
      ? 'PREVENTIVE'
      : 'CURATIVE';
    await prisma.healthCase.update({
      where: { id: row.id },
      data: { careType },
    });
    if (careType === 'PREVENTIVE') preventive++;
    else curative++;
  }

  console.log(
    `Backfilled ${curative} CURATIVE + ${preventive} PREVENTIVE row(s).`,
  );

  const remaining = await prisma.$queryRaw<
    { count: bigint }[]
  >`SELECT COUNT(*)::bigint as count FROM "HealthCase" WHERE "careType" IS NULL`;
  console.log(`Rows still missing careType: ${remaining[0].count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
