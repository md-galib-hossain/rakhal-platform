/**
 * One-off data fix: seed the full `DEFAULT_CHART_OF_ACCOUNTS` into every
 * existing farm that is missing any of it. The chart is seeded per-farm at
 * bootstrap (`LedgerAccountService.seedDefaultChart`), so a farm created
 * before the chart existed (or before a later code such as 5300/5900 was
 * added) never gets the rows retroactively — breeding/expense/purchase
 * posting then fails with "... ledger account is not seeded for this farm".
 *
 * Idempotent and re-runnable — `@@unique([farmId, code])` + `skipDuplicates`
 * means farms that already have a code are left untouched.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/modules/finance-v2/ledger/domain/default-chart-of-accounts';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const farms = await prisma.farm.findMany({ select: { id: true } });
  console.log(`Checking ${farms.length} farm(s) for a complete default chart.`);

  const result = await prisma.ledgerAccount.createMany({
    data: farms.flatMap((farm) =>
      DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
        farmId: farm.id,
        category: account.category,
        code: account.code,
        name: account.name,
        isSystem: true,
      })),
    ),
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} missing ledger account row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
