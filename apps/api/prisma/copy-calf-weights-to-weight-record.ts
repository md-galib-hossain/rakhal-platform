/**
 * RAKHAL-490: copy every CalfWeightRecord row into WeightRecord before the table is dropped.
 *
 * The AnimalEvent header the calf row already owns moves to the new WeightRecord row, so the
 * timeline keeps exactly one WEIGHT event per weighing. Idempotent: a calf row whose
 * cattleId + date + weight already exist in WeightRecord is skipped.
 *
 *   npx ts-node -r tsconfig-paths/register prisma/copy-calf-weights-to-weight-record.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register prisma/copy-calf-weights-to-weight-record.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const dry = process.argv.includes('--dry-run');
  const calfRows = await prisma.calfWeightRecord.findMany({
    orderBy: { createdAt: 'asc' },
  });
  const before = await prisma.weightRecord.count();
  let copied = 0;
  let skipped = 0;

  for (const row of calfRows) {
    const existing = await prisma.weightRecord.findFirst({
      where: {
        cattleId: row.calfId,
        recordedDate: row.measuredDate,
        weightKg: row.weightKg,
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    copied += 1;
    if (dry) continue;
    await prisma.$transaction(async (tx) => {
      await tx.calfWeightRecord.update({
        where: { id: row.id },
        data: { animalEventId: null },
      });
      await tx.weightRecord.create({
        data: {
          cattleId: row.calfId,
          weightKg: row.weightKg,
          recordedDate: row.measuredDate,
          recordedBy: row.recordedBy,
          notes: row.notes,
          createdAt: row.createdAt,
          animalEventId: row.animalEventId,
        },
      });
    });
  }

  const after = await prisma.weightRecord.count();
  console.log(
    `${dry ? 'DRY RUN ' : ''}calf rows=${calfRows.length} copied=${copied} skipped=${skipped} ` +
      `WeightRecord before=${before} after=${after}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
