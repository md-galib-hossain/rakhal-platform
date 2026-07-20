/**
 * One-off cleanup for the "Concentrate Mixer must not create inventory" fix (2026-07-19): before
 * this fix, `finalize()` unconditionally produced a `FeedStock` lot for **both** kinds, so every
 * `CONCENTRATE_TEMPLATE` finalize in the shared dev DB left behind a bogus inventory row (visible
 * in the Feed tab's Prepared segment tagged "Concentrate Mixer", which should never appear there —
 * a template is a virtual recipe/calculator, only a Total Mixed Ration is real inventory). Deletes
 * every `FeedStock` (+ its movements, cascade) whose source concentration's `kind` is
 * `CONCENTRATE_TEMPLATE`. Safe to run multiple times (no-op once clean).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const templateSourced = await prisma.feedStock.findMany({
    where: { concentration: { kind: 'CONCENTRATE_TEMPLATE' } },
    select: { id: true },
  });
  console.log(
    `Found ${templateSourced.length} FeedStock lot(s) bogusly sourced from a Concentrate Mixer.`,
  );
  if (templateSourced.length === 0) return;

  const ids = templateSourced.map((s) => s.id);
  const movements = await prisma.feedStockMovement.deleteMany({
    where: { stockId: { in: ids } },
  });
  const stock = await prisma.feedStock.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(
    `Deleted ${stock.count} FeedStock lot(s) and ${movements.count} movement(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
