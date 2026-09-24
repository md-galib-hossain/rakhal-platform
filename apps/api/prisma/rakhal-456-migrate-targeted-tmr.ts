/**
 * RAKHAL-456 (MILESTONE 27, docs/EPIC_FEED_PROGRAMS.md §4) — one-off data migration for the additive
 * migration `20260924*_rakhal_456_feed_plan_assignments`.
 *
 * Before MILESTONE 27 a TMR (`FeedConcentration.kind = FEED_MIXTURE`) was "live" the moment it was created
 * with a target: `targetType` INDIVIDUAL (+ `cattleId`) or HERD, resolved by the old
 * `FeedRationResolverService`. From now on a program reaches a cow only when it is **applied**
 * (`FeedPlanAssignment`), and the resolver is a shim over the plan resolver. This script carries every
 * existing targeted TMR over so nothing changes for a farm on the day it deploys:
 *
 *   for each live FEED_MIXTURE with targetType INDIVIDUAL|HERD
 *     -> one FeedPlan   (kind TMR_SHORTCUT, name = the recipe's name, made-for = its cow when individual)
 *     -> one PREPARED line (concentrationId = the recipe, kgPerDay = the recipe's total as-fed per head)
 *     -> one ACTIVE FeedPlanAssignment with the same target
 *
 * Old resolver semantics are kept: "the newest wins" — when several TMRs target the same cow, or several
 * are HERD, only the newest gets the assignment; the others still get a plan (so nothing is lost), just
 * unapplied. A cow that is no longer in the active herd gets a plan but no assignment.
 *
 * Idempotent: a recipe that already has a TMR_SHORTCUT plan with a line on it is skipped.
 * `--dry-run` reports without writing. After a real run a **verification pass** re-resolves every active
 * cow both the old way (from `FeedConcentration` targeting) and the new way (plan assignments) and prints
 * any mismatch (exit code 1 if there is one).
 * Run once, after `prisma migrate deploy`:
 *   pnpm exec tsx prisma/rakhal-456-migrate-targeted-tmr.ts [--dry-run]
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { activeHerd } from '../src/modules/cattle/domain/herd-scope';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const DRY_RUN = process.argv.includes('--dry-run');
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Recipes with no positive total kg cannot become a plan line (a line needs kgPerDay > 0). They carry no
 * feed, so there is nothing to program; the verify pass treats them as expected, not as a mismatch. */
const emptyRecipeIds = new Set<string>();

async function uniquePlanName(farmId: string, base: string) {
  let name = base;
  for (let n = 2; ; n++) {
    const clash = await prisma.feedPlan.findFirst({
      where: {
        farmId,
        isActive: true,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!clash) return name;
    name = `${base} (${n})`;
  }
}

async function main() {
  const recipes = await prisma.feedConcentration.findMany({
    where: {
      kind: 'FEED_MIXTURE',
      deletedAt: null,
      targetType: { in: ['INDIVIDUAL', 'HERD'] },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' }, // newest first: it claims the target
  });
  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Migrating ${recipes.length} targeted TMR recipe(s)...`,
  );

  // Targets already taken, this run or by an earlier one.
  const takenCow = new Set<string>();
  const takenHerd = new Set<string>();
  const existing = await prisma.feedPlanAssignment.findMany({
    where: { removedAt: null, targetType: { in: ['INDIVIDUAL', 'HERD'] } },
    select: { farmId: true, targetType: true, cattleId: true },
  });
  for (const a of existing) {
    if (a.targetType === 'HERD') takenHerd.add(a.farmId);
    else if (a.cattleId) takenCow.add(`${a.farmId}:${a.cattleId}`);
  }

  let plans = 0;
  let assigned = 0;
  let planOnly = 0;
  let skipped = 0;
  let noKg = 0;

  for (const r of recipes) {
    const already = await prisma.feedPlanLine.findFirst({
      where: {
        concentrationId: r.id,
        plan: { kind: 'TMR_SHORTCUT', isActive: true },
      },
      select: { id: true },
    });
    if (already) {
      skipped++;
      continue;
    }
    const kgPerDay = round2(r.items.reduce((s, i) => s + i.amountKg, 0));
    if (!(kgPerDay > 0)) {
      noKg++;
      emptyRecipeIds.add(r.id);
      console.warn(
        `  skip "${r.name}" (${r.id}): recipe has no positive total kg`,
      );
      continue;
    }

    let claims = false;
    if (r.targetType === 'HERD') {
      claims = !takenHerd.has(r.farmId);
      if (claims) takenHerd.add(r.farmId);
    } else if (r.cattleId) {
      const cow = await prisma.cattle.findFirst({
        where: { ...activeHerd(r.farmId), id: r.cattleId },
        select: { id: true },
      });
      const key = `${r.farmId}:${r.cattleId}`;
      claims = !!cow && !takenCow.has(key);
      if (claims) takenCow.add(key);
    }

    plans++;
    if (claims) assigned++;
    else planOnly++;
    if (DRY_RUN) continue;

    const name = await uniquePlanName(r.farmId, r.name);
    await prisma.$transaction(async (tx) => {
      const plan = await tx.feedPlan.create({
        data: {
          farmId: r.farmId,
          name,
          kind: 'TMR_SHORTCUT',
          notes: 'Migrated from the recipe target (RAKHAL-456).',
          madeForCattleId: r.targetType === 'INDIVIDUAL' ? r.cattleId : null,
          createdBy: r.createdBy,
          lines: {
            create: {
              farmId: r.farmId,
              lineType: 'PREPARED',
              concentrationId: r.id,
              kgPerDay,
              sortOrder: 0,
            },
          },
        },
      });
      if (claims) {
        await tx.feedPlanAssignment.create({
          data: {
            farmId: r.farmId,
            planId: plan.id,
            targetType: r.targetType === 'HERD' ? 'HERD' : 'INDIVIDUAL',
            cattleId: r.targetType === 'INDIVIDUAL' ? r.cattleId : null,
            appliedBy: r.createdBy,
            appliedAt: r.createdAt,
          },
        });
      }
    });
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}plans: ${plans} (assigned ${assigned}, plan-only ${planOnly}); ` +
      `already migrated: ${skipped}; skipped (no kg): ${noKg}`,
  );
  if (!DRY_RUN) await verify();
}

/** Legacy resolution (FeedConcentration targeting) vs new (plan assignments), every active cow. */
async function verify() {
  const cows = await prisma.cattle.findMany({
    where: { herdStatus: 'ACTIVE', deletedAt: null },
    select: { id: true, farmId: true },
  });
  const mismatches: string[] = [];
  for (const c of cows) {
    const legacyOf = async (where: object) =>
      (
        await prisma.feedConcentration.findFirst({
          where: {
            farmId: c.farmId,
            deletedAt: null,
            kind: 'FEED_MIXTURE',
            ...where,
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      )?.id ?? null;
    const legacy =
      (await legacyOf({ targetType: 'INDIVIDUAL', cattleId: c.id })) ??
      (await legacyOf({ targetType: 'HERD' }));

    const individual = await prisma.feedPlanAssignment.findFirst({
      where: {
        farmId: c.farmId,
        removedAt: null,
        targetType: 'INDIVIDUAL',
        cattleId: c.id,
      },
      include: { plan: { include: { lines: true } } },
    });
    const winner =
      individual ??
      (await prisma.feedPlanAssignment.findFirst({
        where: { farmId: c.farmId, removedAt: null, targetType: 'HERD' },
        include: { plan: { include: { lines: true } } },
      }));
    const line = winner?.plan.lines[0];
    const now =
      winner?.plan.kind === 'TMR_SHORTCUT'
        ? (line?.concentrationId ?? null)
        : null;
    if (
      legacy !== now &&
      !(legacy && emptyRecipeIds.has(legacy) && now === null)
    )
      mismatches.push(`${c.id}: legacy=${legacy} new=${now}`);
  }
  console.log(
    `Verification: ${cows.length} active cow(s) checked, ${mismatches.length} mismatch(es) ` +
      `(${emptyRecipeIds.size} empty recipe(s) expected to resolve to nothing).`,
  );
  for (const m of mismatches.slice(0, 20)) console.log('  ' + m);
  if (mismatches.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
