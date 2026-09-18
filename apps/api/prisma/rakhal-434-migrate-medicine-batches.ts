/**
 * RAKHAL-434 backfill (docs/EPIC_MEDICINE_BATCH_MODEL.md): one-off 1:1 split of every existing
 * `Medicine` row into itself (catalog fields only, untouched) plus one new `MedicineBatch` row
 * carrying its current `currentStock`/`costPerUnit`/`purchaseDate`/`expiryDate`/`batchId→batchCode`.
 * No merging/deduping of same-name products (per the epic — a later cleanup ticket can offer that
 * once real farm data shows the need). Every pre-existing `MedicineStockMovement` for a Medicine is
 * repointed onto that medicine's new batch (`medicineBatchId`), since there is exactly one batch per
 * product at this point in the split. `Medicine`'s own stock/cost/date columns are NOT dropped here —
 * they stay authoritative until RAKHAL-435 rewrites `MedicineService` onto `MedicineBatch`. Safe to
 * run multiple times: a `Medicine` that already has a batch (from a prior run) is skipped.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const candidates = await prisma.medicine.findMany({
    where: { batches: { none: {} } },
  });
  console.log(
    `Found ${candidates.length} Medicine row(s) without a batch yet.`,
  );
  if (candidates.length === 0) return;

  let migrated = 0;
  for (const med of candidates) {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.medicineBatch.create({
        data: {
          medicineId: med.id,
          farmId: med.farmId,
          batchCode: med.batchId,
          currentStock: med.currentStock,
          costPerUnit: med.costPerUnit,
          purchaseDate: med.purchaseDate,
          expiryDate: med.expiryDate,
          createdBy: med.createdBy,
        },
      });
      await tx.medicineStockMovement.updateMany({
        where: { medicineId: med.id, medicineBatchId: null },
        data: { medicineBatchId: batch.id },
      });
    });
    migrated++;
  }
  console.log(`Migrated ${migrated} Medicine row(s) to a MedicineBatch.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
