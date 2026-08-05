import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({
    connectionString:
      'postgresql://postgres:1234@localhost:5432/rakhal-dev-local?schema=public',
  });
  const prisma = new PrismaClient({ adapter });
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "FarmModuleSettings" ADD COLUMN IF NOT EXISTS "milkColostrumWindowDays" INTEGER NOT NULL DEFAULT 5;',
  );
  const r = await prisma.farmModuleSettings.findFirst();
  console.log('OK', r?.milkColostrumWindowDays);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
