/**
 * RD-096 (docs/TECH_DEBT.md) — one-off cleanup for the demo owner
 * (`owner@demo.rakhal.test`) farm-picker pollution: several e2e specs used to
 * call `farmService.create(demoOwnerUserId, {...})` for isolation and never
 * tore the farm down (only `ctx.app.close()`), so every run left a permanent
 * junk farm behind. That leak is now fixed at the source (`test/utils/e2e.ts`
 * → `createThrowawayOwner`/`deleteThrowawayOwner`, applied across the 14
 * affected specs) — this script is only for the ~30+ junk farms that already
 * exist in the shared dev DB from before the fix.
 *
 * Mirrors `prisma/cleanup-template-sourced-stock.ts`'s own convention: a
 * direct `PrismaClient`, a dry-run listing by default, and an explicit
 * `--confirm` flag required before anything is actually deleted.
 *
 * SAFETY:
 *  - Only ever targets farms owned by the demo owner.
 *  - The farm literally named "Demo Farm" (the real demo seed data) is never
 *    touched, matched by an exact name comparison.
 *  - The demo owner's own User row is never deleted — only farms.
 *  - Every delete step is `.catch(() => undefined)` (best-effort, same idiom
 *    `deleteThrowawayOwner` uses) — a farm that can't be fully cleaned up
 *    (e.g. an FK this script doesn't enumerate) is skipped, not half-deleted
 *    in an inconsistent way that blocks a later retry.
 *
 * Usage:
 *   npx ts-node prisma/cleanup-demo-owner-e2e-farms.ts            # dry run (list only)
 *   npx ts-node prisma/cleanup-demo-owner-e2e-farms.ts --confirm  # actually delete
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_OWNER_EMAIL = 'owner@demo.rakhal.test';
const PROTECTED_FARM_NAME = 'Demo Farm';

/** Lowercases the first letter of a Prisma model name to get its `prisma.<x>` delegate name. */
function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Every Prisma model with a direct `farmId` scalar field, discovered from the
 * DMMF rather than hand-maintained — this is the "check prisma/schemas/**\/*.prisma
 * for any model with a farmId field" the RD-096 ticket asks for, done
 * programmatically so it can't silently drift out of date as new modules ship.
 */
function farmScopedDelegates(): string[] {
  return Prisma.dmmf.datamodel.models
    .filter((m) =>
      m.fields.some((f) => f.name === 'farmId' && f.kind === 'scalar'),
    )
    .map((m) => delegateName(m.name));
}

/**
 * A handful of real domain rows are farm-scoped only *transitively* (through
 * a parent that itself has `farmId`), so the DMMF scan above misses them.
 * Deleted first, explicitly, in child-before-parent order, mirroring
 * `deleteThrowawayOwner`'s own JournalEntry -> JournalTransaction ->
 * LedgerAccount chain plus the other precedents this ticket's 13 converted
 * specs already needed (SaleLine before Sale, FeedStockMovement before
 * FeedStock).
 */
async function deleteTransitiveChildren(farmId: string): Promise<void> {
  await prisma.journalEntry
    .deleteMany({ where: { journalTransaction: { farmId } } })
    .catch(() => undefined);
  await prisma.saleLine
    .deleteMany({ where: { sale: { farmId } } })
    .catch(() => undefined);
  await prisma.purchaseLine
    .deleteMany({ where: { purchase: { farmId } } })
    .catch(() => undefined);
  await prisma.feedStockMovement
    .deleteMany({ where: { stock: { farmId } } })
    .catch(() => undefined);
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');

  const owner = await prisma.user.findFirst({
    where: { email: DEMO_OWNER_EMAIL },
    select: { id: true, email: true },
  });
  if (!owner) {
    console.log(`No user found for ${DEMO_OWNER_EMAIL} — nothing to do.`);
    return;
  }

  const farms = await prisma.farm.findMany({
    where: { ownerId: owner.id, name: { not: PROTECTED_FARM_NAME } },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `Demo owner (${owner.email}, ${owner.id}) owns ${farms.length} farm(s) other than "${PROTECTED_FARM_NAME}":\n`,
  );
  for (const f of farms) {
    console.log(
      `  - ${f.name}  [${f.id}]  created ${f.createdAt.toISOString()}`,
    );
  }

  if (farms.length === 0) {
    console.log('\nNothing to clean up.');
    return;
  }

  if (!confirm) {
    console.log(
      `\nDry run only (no --confirm passed). Re-run with --confirm to delete the ${farms.length} farm(s) listed above.`,
    );
    return;
  }

  const delegates = farmScopedDelegates();
  console.log(
    `\n--confirm passed. Deleting ${farms.length} farm(s) — ${delegates.length} farm-scoped model(s) swept per farm...\n`,
  );

  let deletedCount = 0;
  for (const farm of farms) {
    await deleteTransitiveChildren(farm.id);

    // Best-effort, multi-pass: some farm-scoped models reference each other
    // (e.g. Payable -> Purchase), so a single pass in DMMF-declaration order
    // can hit FK violations. Re-sweeping several times lets later passes
    // clean up whatever the previous pass's failures were blocking, without
    // hand-maintaining a full dependency order for 50+ models.
    for (let pass = 0; pass < 4; pass++) {
      for (const delegate of delegates) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (prisma as any)[delegate];
        if (!model?.deleteMany) continue;
        await model
          .deleteMany({ where: { farmId: farm.id } })
          .catch(() => undefined);
      }
    }

    const deleted = await prisma.farm
      .delete({ where: { id: farm.id } })
      .then(() => true)
      .catch((err: unknown) => {
        console.log(
          `  ! Could not fully delete "${farm.name}" [${farm.id}] — leftover FK reference(s):`,
          err instanceof Error ? err.message.split('\n')[0] : err,
        );
        return false;
      });
    if (deleted) {
      deletedCount++;
      console.log(`  - deleted "${farm.name}" [${farm.id}]`);
    }
  }

  console.log(
    `\nDone. Deleted ${deletedCount}/${farms.length} farm(s). The demo owner user row itself was never touched.`,
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
