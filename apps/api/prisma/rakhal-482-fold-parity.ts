/**
 * RAKHAL-482 parity check: for every cow with reproduction history, compare the
 * reproductive state derived from the domain TABLES (old path) with the one
 * derived from the AnimalEvent FOLD (new path). Read-only.
 *
 *   npx ts-node -r tsconfig-paths/register prisma/rakhal-482-fold-parity.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { foldReproduction } from '../src/modules/reproduction/domain/reproduction-fold';
import { loadFoldFacts } from '../src/modules/reproduction/application/services/reproduction-fold-facts';
import { deriveReproductionState } from '../src/modules/reproduction/application/services/reproduction-derivation.service';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const day = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : '-';

async function main() {
  const cows = await prisma.cattle.findMany({
    where: {
      OR: [
        { breedingEvents: { some: {} } },
        { pregnancies: { some: {} } },
        { calvingEvents: { some: {} } },
        { reproductionProfile: { isNot: null } },
      ],
    },
    select: {
      id: true,
      tagNumber: true,
      farmId: true,
      gender: true,
      dateOfBirth: true,
    },
  });
  const vwpCache = new Map<string, number>();
  const ageCache = new Map<string, number>();
  const stats = {
    cows: 0,
    same: 0,
    differ: 0,
    noEvents: 0,
    conceptionDiffer: 0,
    calvingDiffer: 0,
  };
  const diffs = new Map<string, { n: number; examples: string[] }>();
  const note = (k: string, ex: string) => {
    const e = diffs.get(k) ?? { n: 0, examples: [] };
    e.n += 1;
    if (e.examples.length < 3) e.examples.push(ex);
    diffs.set(k, e);
  };

  for (const c of cows) {
    stats.cows += 1;
    let vwp = vwpCache.get(c.farmId);
    if (vwp === undefined) {
      const s = await prisma.farmModuleSettings.findUnique({
        where: { farmId: c.farmId },
      });
      vwp = s?.reproVwpDays ?? 60;
      vwpCache.set(c.farmId, vwp);
      ageCache.set(c.farmId, s?.cattleLifecycleBreedingAgeDays ?? 450);
    }
    const [
      totalBreedings,
      pregnancies,
      calvings,
      lastBreeding,
      lastCalving,
      current,
    ] = await Promise.all([
      prisma.breedingEvent.count({
        where: { cattleId: c.id, voidedAt: null },
      }),
      prisma.pregnancy.findMany({
        where: {
          cattleId: c.id,
          status: { notIn: ['FAILED', 'CANCELLED_CORRECTION'] },
        },
        select: { id: true },
      }),
      prisma.calvingEvent.count({ where: { cattleId: c.id } }),
      prisma.breedingEvent.findFirst({
        where: { cattleId: c.id, voidedAt: null },
        orderBy: { breedingDate: 'desc' },
      }),
      prisma.calvingEvent.findFirst({
        where: { cattleId: c.id },
        orderBy: { calvingDate: 'desc' },
      }),
      prisma.pregnancy.findFirst({
        where: { cattleId: c.id, status: 'ACTIVE' },
        orderBy: { conceptionDate: 'desc' },
      }),
    ]);
    const shared = {
      now: new Date(),
      gender: c.gender,
      dateOfBirth: c.dateOfBirth,
      hasBreedingHistory:
        totalBreedings > 0 || pregnancies.length > 0 || calvings > 0,
      vwpDays: vwp,
      breedingAgeDays: ageCache.get(c.farmId),
    };
    const oldState = deriveReproductionState({
      ...shared,
      hasActivePregnancy: Boolean(current),
      lastBreeding: lastBreeding ? { status: lastBreeding.status } : null,
      lastCalving: lastCalving
        ? { calvingDate: lastCalving.calvingDate }
        : null,
    });

    const facts = await loadFoldFacts(prisma, c.id);
    if (!facts.length) {
      stats.noEvents += 1;
      continue;
    }
    const fold = foldReproduction(facts);
    const newState = deriveReproductionState({
      ...shared,
      hasActivePregnancy: fold.hasActivePregnancy,
      lastBreeding: fold.pendingBreeding ? { status: 'PENDING_CHECK' } : null,
      lastCalving: fold.lastCalvingAt
        ? { calvingDate: fold.lastCalvingAt }
        : null,
    });
    if (oldState === newState) stats.same += 1;
    else {
      stats.differ += 1;
      note(
        `${oldState} -> ${newState}`,
        `${c.tagNumber}: facts=${facts.map((f) => `${f.type}${f.result ? ':' + f.result : ''}@${day(f.at)}${f.open === false ? '(closed)' : ''}`).join(' ')} | tables: breedings=${totalBreedings} preg=${pregnancies.length} activePreg=${Boolean(current)} lastBreeding=${lastBreeding?.status ?? '-'}@${day(lastBreeding?.breedingDate)} lastCalving=${day(lastCalving?.calvingDate)}`,
      );
    }
    if (
      current &&
      fold.pregnancy &&
      day(current.conceptionDate) !== day(fold.pregnancy.conceptionDate)
    ) {
      stats.conceptionDiffer += 1;
      note(
        `conception ${day(current.conceptionDate)} (${current.conceptionConfidence}) vs fold ${day(fold.pregnancy.conceptionDate)} (${fold.pregnancy.confidence})`,
        `${c.tagNumber}: facts=${facts.map((f) => `${f.type}${f.result ? ':' + f.result : ''}@${day(f.at)}${f.gestationDay ? ' gd' + f.gestationDay : ''}${f.expectedCalvingDate ? ' ecd' + day(f.expectedCalvingDate) : ''}`).join(' ')} | pregnancy.breedingEventId=${current.breedingEventId ?? '-'}`,
      );
    }
    if (day(lastCalving?.calvingDate) !== day(fold.lastCalvingAt))
      stats.calvingDiffer += 1;
  }
  console.log(JSON.stringify(stats));
  for (const [k, v] of diffs) {
    console.log(`\n${v.n} x ${k}`);
    for (const e of v.examples) console.log('   ' + e);
  }
  await prisma.$disconnect();
}
void main();
