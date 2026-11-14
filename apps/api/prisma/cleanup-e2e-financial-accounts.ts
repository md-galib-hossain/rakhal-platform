/**
 * One-off hygiene cleanup (no ticket #, 2026-08-28), paired with the range widening in
 * `financial-account.service.ts` (`CUSTOM_LEDGER_CODE_MAX`, 9999 -> 9999999). Months of
 * concurrent-agent e2e runs against the shared dev demo farm created throwaway
 * `FinancialAccount` rows (name pattern `E2E...`) via `POST /finance/accounts`; most specs'
 * `afterAll` never deleted them (confirmed: only `rakhal-377-void-refund.e2e-spec.ts` out of
 * 24 specs that create a financial account actually cleans up after itself — the audit this
 * script accompanies). 113 of the demo farm's 454 `FinancialAccount` rows are E2E-named
 * orphans as of 2026-08-28.
 *
 * This does NOT reclaim `LedgerAccount.code` values or move the `FarmCounter` — the counter
 * only ever increments and never looks at existing rows, so deleting these rows cannot free
 * codes back up (that's why the range was widened instead of relying on cleanup). This is
 * pure DB hygiene: fewer dead rows cluttering `GET /finance/accounts` on the shared dev farm.
 *
 * Skips (and reports) any row a Postgres FK still restricts — e.g. one with a `FinancePayment`
 * or `OtherIncome` still pointing at it — rather than failing the whole run.
 *
 * Usage: `npx ts-node prisma/cleanup-e2e-financial-accounts.ts [farmId]`
 * Defaults to the shared dev demo farm (cmslzr34q003wuofcwaleuwsv) if no farmId is passed.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_FARM_ID = 'cmslzr34q003wuofcwaleuwsv';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const farmId = process.argv[2] ?? DEFAULT_FARM_ID;

  const orphans = await prisma.financialAccount.findMany({
    where: { farmId, name: { startsWith: 'E2E' } },
    select: { id: true, name: true },
  });
  console.log(
    `Found ${orphans.length} E2E-named FinancialAccount row(s) for farm ${farmId}.`,
  );

  let deleted = 0;
  let skipped = 0;
  for (const account of orphans) {
    try {
      await prisma.financialAccount.delete({ where: { id: account.id } });
      deleted++;
    } catch {
      // Still referenced by a FinancePayment/OtherIncome/etc row — leave it, don't
      // corrupt real financial history for the sake of tidiness.
      skipped++;
    }
  }
  console.log(`Deleted ${deleted}, skipped ${skipped} (still FK-referenced).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
