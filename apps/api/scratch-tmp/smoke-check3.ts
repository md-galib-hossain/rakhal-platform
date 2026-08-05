import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
async function main() {
  const adapter = new PrismaPg({ connectionString: 'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public' });
  const prisma = new PrismaClient({ adapter });
  const total = await prisma.reproductionProfile.count();
  const assessed = await prisma.reproductionProfile.count({ where: { reproductiveStatus: { not: null } } });
  console.log({ total, assessed });
  const sample = await prisma.reproductionProfile.findMany({ take: 5 });
  console.log(sample);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
