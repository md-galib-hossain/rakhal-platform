/**
 * RD-068 one-off backfill: `Supplier.paymentTermsDays` never had a write path before this fix
 * (`workspace-settings.service.ts`'s `createSupplier()`/`updateSupplier()`), so every existing
 * row sits at its `@default(0)` regardless of what its free-text `paymentTerms` says. Re-derives
 * `paymentTermsDays` from `paymentTerms` for every row using the same
 * `parsePaymentTermsDays()` the write path now uses, so existing suppliers agree with what a
 * fresh create/update would produce. Safe to run multiple times (idempotent — re-parses the same
 * source text each time).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parsePaymentTermsDays } from '../src/modules/settings/domain/payment-terms';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, paymentTerms: true, paymentTermsDays: true },
  });

  let changed = 0;
  for (const s of suppliers) {
    const derived = parsePaymentTermsDays(s.paymentTerms);
    if (derived !== s.paymentTermsDays) {
      await prisma.supplier.update({
        where: { id: s.id },
        data: { paymentTermsDays: derived },
      });
      changed++;
      console.log(
        `Supplier ${s.id}: paymentTerms=${JSON.stringify(s.paymentTerms)} paymentTermsDays ${s.paymentTermsDays} -> ${derived}`,
      );
    }
  }
  console.log(`Done. ${changed}/${suppliers.length} row(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
