import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({
    connectionString:
      'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public',
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const r = await prisma.farmModuleSettings.findFirst();
    console.log('OK', r?.milkColostrumWindowDays);
  } catch (e) {
    console.log('FAIL', (e as Error).message);
  }
  await prisma.$disconnect();
}
main();
