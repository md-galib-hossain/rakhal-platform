import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({
    connectionString: 'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public',
  });
  const prisma = new PrismaClient({ adapter });
  const farm = await prisma.farm.findFirst();
  if (!farm) {
    console.log('No farm found');
    return;
  }
  const cow = await prisma.cattle.findFirst({
    where: { farmId: farm.id, gender: 'FEMALE' },
    include: {
      reproductionProfile: { select: { reproductiveStatus: true, totalCalvings: true, totalAbortions: true, lastCalvingDate: true } },
      lactations: { where: { status: 'ACTIVE' }, take: 1 },
      pregnancies: { where: { status: 'ACTIVE' }, take: 1 },
      heatEvents: { orderBy: { heatDateTime: 'desc' }, take: 1 },
      breedingEvents: { orderBy: { breedingDate: 'desc' }, take: 3 },
      dryPeriods: { where: { actualEndDate: null }, take: 1 },
    },
  });
  console.log(JSON.stringify(cow, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
