/**
 * One-off data fix for RAKHAL-367 (MILESTONE 22, closes RD-060): the chart
 * of accounts is seeded per-farm at bootstrap time
 * (`LedgerAccountService.seedDefaultChart`, called by `FarmService.create`
 * and `prisma/seed.ts`) — a farm created *before* this ticket added the
 * `5900 Other Expense` entry to `DEFAULT_CHART_OF_ACCOUNTS` never gets it
 * retroactively. This script seeds `5900` into every existing farm's chart.
 *
 * Idempotent and re-runnable — `LedgerAccount.@@unique([farmId, code])`
 * means a re-run simply skips every farm that already has `5900`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, LedgerAccountCategory } from '@prisma/client';

const OTHER_EXPENSE_CODE = '5900';
const OTHER_EXPENSE_NAME = 'Other Expense';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const farms = await prisma.farm.findMany({ select: { id: true } });
  console.log(`Checking ${farms.length} farm(s) for a seeded 5900 account.`);

  const result = await prisma.ledgerAccount.createMany({
    data: farms.map((farm) => ({
      farmId: farm.id,
      category: LedgerAccountCategory.EXPENSE,
      code: OTHER_EXPENSE_CODE,
      name: OTHER_EXPENSE_NAME,
      isSystem: true,
    })),
    skipDuplicates: true,
  });

  console.log(`Seeded 5900 Other Expense for ${result.count} farm(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
