import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { deriveReproductionAlerts } from '../src/modules/reproduction/domain/reproduction-alerts';
import { deriveLactationStage } from '../src/modules/reproduction/domain/lactation-stage';
import { derivePregnancyStage } from '../src/modules/reproduction/domain/pregnancy-stage';

async function main() {
  const adapter = new PrismaPg({ connectionString: 'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public' });
  const prisma = new PrismaClient({ adapter });

  const profile = await prisma.reproductionProfile.findFirst({ where: { reproductiveStatus: { not: null } } });
  if (!profile) { console.log('none'); return; }
  const cow = await prisma.cattle.findUnique({
    where: { id: profile.cattleId },
    include: {
      reproductionProfile: true,
      lactations: { where: { status: 'ACTIVE' }, take: 1 },
      pregnancies: { where: { status: 'ACTIVE' }, take: 1 },
      heatEvents: { orderBy: { heatDateTime: 'desc' }, take: 1 },
      breedingEvents: { orderBy: { breedingDate: 'desc' }, take: 20 },
      dryPeriods: { where: { actualEndDate: null }, take: 1 },
    },
  });
  if (!cow) { console.log('no cow'); return; }
  const settings = await prisma.farmModuleSettings.findUnique({ where: { farmId: cow.farmId } });
  console.log('farmId:', cow.farmId, 'tag:', cow.tagNumber, 'reproductiveStatus:', cow.reproductionProfile?.reproductiveStatus, 'hasSettings:', !!settings);

  const s = settings ?? (await prisma.farmModuleSettings.create({ data: { farmId: cow.farmId } }));
  const now = new Date();
  const lastCalvingDate = cow.reproductionProfile?.lastCalvingDate ?? null;
  const state = cow.reproductionProfile!.reproductiveStatus!;
  const breedingsSinceLastSuccess = cow.breedingEvents.filter(
    (b) => !lastCalvingDate || b.breedingDate.getTime() > lastCalvingDate.getTime(),
  ).length;
  const daysOpen = lastCalvingDate && state !== 'PREGNANT'
    ? Math.floor((now.getTime() - lastCalvingDate.getTime()) / 86400000)
    : null;
  const alerts = deriveReproductionAlerts({
    now,
    reproductionState: state as any,
    recentHeat: cow.heatEvents[0] ? { heatDateTime: cow.heatEvents[0].heatDateTime } : null,
    heatWindowDays: s.reproHeatWindowDays,
    lastBreeding: cow.breedingEvents[0] ? { status: cow.breedingEvents[0].status, expectedPregnancyCheckDate: cow.breedingEvents[0].expectedPregnancyCheckDate } : null,
    currentPregnancy: cow.pregnancies[0] ? { expectedCalvingDate: cow.pregnancies[0].expectedCalvingDate } : null,
    closeUpWindowDays: s.reproCloseUpWindowDays,
    overdueCheckDays: s.reproOverduePregnancyCheckDays,
    calvingOverdueDays: s.reproCalvingOverdueDays,
    breedingsSinceLastSuccess,
    repeatBreederThreshold: s.reproRepeatBreederThreshold,
    daysOpen,
    longDaysOpenThresholdDays: s.reproLongDaysOpenDays,
    totalAbortions: cow.reproductionProfile?.totalAbortions ?? 0,
    hasReproductiveHold: false,
  });
  const lactationStage = deriveLactationStage({
    now,
    lactationStartDate: cow.lactations[0]?.startDate ?? null,
    isInActiveDryPeriod: cow.dryPeriods.length > 0,
    farmSettings: { freshDays: s.lactationFreshDays, earlyDays: s.lactationEarlyDays, midDays: s.lactationMidDays },
  });
  const pregnancyStage = derivePregnancyStage({
    now,
    conceptionDate: cow.pregnancies[0]?.conceptionDate ?? null,
    farmSettings: { earlyDays: s.pregnancyEarlyDays, midDays: s.pregnancyMidDays, closeUpWindowDays: s.reproCloseUpWindowDays, gestationDays: 280 },
  });
  console.log('reproductionAlerts:', alerts);
  console.log('lactationStage:', lactationStage);
  console.log('pregnancyStage:', pregnancyStage);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
