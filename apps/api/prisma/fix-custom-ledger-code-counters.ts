/**
 * One-off data fix for RD-061 (2026-08-17): `FinancialAccountService.nextCustomLedgerCode`
 * moved the custom-account `LedgerAccount.code` range from `1300+` (unbounded, eventually
 * collides with the seeded system chart's `2000`/`3000`/`4000+`/`5000+` rows) to a dedicated
 * `9000-9999` range. Changing the code's `CUSTOM_LEDGER_CODE_START` constant only affects a
 * *new* `finance-v2-account:<farmId>` `FarmCounter` row (the `create` branch of the upsert) —
 * any farm that already allocated a custom account has a persisted counter row whose `value`
 * would otherwise just keep incrementing from wherever it was (e.g. `1999` on the shared dev
 * demo farm, one increment away from re-colliding with `2000`). This script bumps every
 * existing `finance-v2-account:*` counter forward to `CUSTOM_LEDGER_CODE_START - 1` (never
 * backward) so its *next* allocation lands at `9000`, not wherever it was mid-collision.
 * Already-created `LedgerAccount` rows in the old `1300-1999` range are untouched — they
 * don't collide with anything and stay valid. Safe to run multiple times (no-op once every
 * counter is already at or past the new floor).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const CUSTOM_LEDGER_CODE_START = 9000;
const FLOOR = CUSTOM_LEDGER_CODE_START - 1;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const counters = await prisma.farmCounter.findMany({
    where: {
      scope: { startsWith: 'finance-v2-account:' },
      value: { lt: FLOOR },
    },
  });
  console.log(
    `Found ${counters.length} finance-v2-account counter(s) below the new floor (${FLOOR}).`,
  );
  for (const counter of counters) {
    await prisma.farmCounter.update({
      where: { scope: counter.scope },
      data: { value: FLOOR },
    });
    console.log(`  ${counter.scope}: ${counter.value} -> ${FLOOR}`);
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
