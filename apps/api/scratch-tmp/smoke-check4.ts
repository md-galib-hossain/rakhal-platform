import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
async function main() {
  const adapter = new PrismaPg({ connectionString: 'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public' });
  const prisma = new PrismaClient({ adapter });
  const farms = await prisma.farm.findMany({ select: { id: true, name: true } });
  console.log('farms:', farms);
  for (const f of farms) {
    const c = await prisma.cattle.count({ where: { farmId: f.id, gender: 'FEMALE', reproductionProfile: { reproductiveStatus: { not: null } } } });
    console.log(f.id, 'matching cows:', c);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
