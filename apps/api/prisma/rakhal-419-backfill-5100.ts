/**
 * One-off data fix for RAKHAL-419 (MILESTONE 24): the chart of accounts is
 * seeded per-farm at bootstrap time (`LedgerAccountService.seedDefaultChart`,
 * called by `FarmService.create` and `prisma/seed.ts`). `5100 Medicine` has
 * been in `DEFAULT_CHART_OF_ACCOUNTS` since RAKHAL-333 (unlike `5900`, it was
 * never added later), so almost every farm already has it — verified live:
 * 6 of 350 farms on the shared dev DB are missing it (likely pre-RAKHAL-333
 * fixture/demo farms created before the ledger system existed at all). This
 * script seeds `5100` into every farm that doesn't already have it, the same
 * shape as RAKHAL-367's `m22-seed-5900.ts`.
 *
 * Idempotent and re-runnable — `LedgerAccount.@@unique([farmId, code])` means
 * a re-run simply skips every farm that already has `5100`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, LedgerAccountCategory } from '@prisma/client';

const MEDICINE_CODE = '5100';
const MEDICINE_NAME = 'Medicine';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const farms = await prisma.farm.findMany({ select: { id: true } });
  console.log(`Checking ${farms.length} farm(s) for a seeded 5100 account.`);

  const result = await prisma.ledgerAccount.createMany({
    data: farms.map((farm) => ({
      farmId: farm.id,
      category: LedgerAccountCategory.EXPENSE,
      code: MEDICINE_CODE,
      name: MEDICINE_NAME,
      isSystem: true,
    })),
    skipDuplicates: true,
  });

  console.log(`Seeded 5100 Medicine for ${result.count} farm(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
