import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  SystemRoleName,
} from '../src/modules/permission/domain/permission-catalogue';

/**
 * RBAC + dev-data seed (RAKHAL-019). Idempotent — safe to run repeatedly.
 *
 *   pnpm seed     # or: ts-node -r tsconfig-paths/register prisma/seed.ts
 *
 * Seeds:
 *  1. The permission catalogue (PERMISSIONS).
 *  2. The three global system roles (Owner/Manager/Worker) + their grants.
 *  3. (non-production only) a demo owner + farm + membership so the whole auth →
 *     tenant → permission chain is exercisable immediately.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedPermissions(): Promise<void> {
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { group: perm.group, description: perm.description },
      create: perm,
    });
  }
  console.log(`✔ permissions: ${PERMISSIONS.length}`);
}

async function seedRole(name: SystemRoleName): Promise<string> {
  const existing = await prisma.role.findFirst({
    where: { name, farmId: null, isSystemRole: true },
    select: { id: true },
  });
  const role =
    existing ??
    (await prisma.role.create({
      data: { name, isSystemRole: true, description: `System ${name} role` },
      select: { id: true },
    }));

  const keys = ROLE_PERMISSIONS[name];
  const perms = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });

  const missing = keys.filter((k) => !perms.some((p) => p.key === k));
  if (missing.length > 0) {
    throw new Error(
      `Role ${name} references unknown permissions: ${missing.join(', ')}`,
    );
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  console.log(`✔ role ${name}: ${perms.length} permissions`);
  return role.id;
}

async function seedDemo(ownerRoleId: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const email = 'owner@demo.rakhal.test';
  const passwordHash = await argon2.hash('DemoPass123', {
    type: argon2.argon2id,
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Demo Owner', passwordHash, isEmailVerified: true },
    select: { id: true },
  });

  const existingFarm = await prisma.farm.findFirst({
    where: { slug: 'demo-farm' },
    select: { id: true },
  });
  const farm =
    existingFarm ??
    (await prisma.farm.create({
      data: { name: 'Demo Farm', slug: 'demo-farm', ownerId: user.id },
      select: { id: true },
    }));

  await prisma.farmMember.upsert({
    where: { farmId_userId: { farmId: farm.id, userId: user.id } },
    update: { roleId: ownerRoleId },
    create: { farmId: farm.id, userId: user.id, roleId: ownerRoleId },
  });

  console.log(
    `✔ demo: ${email} / DemoPass123 — userId=${user.id} farmId=${farm.id}`,
  );
}

async function main(): Promise<void> {
  await seedPermissions();
  const ownerRoleId = await seedRole(SYSTEM_ROLES.OWNER);
  await seedRole(SYSTEM_ROLES.MANAGER);
  await seedRole(SYSTEM_ROLES.WORKER);
  await seedDemo(ownerRoleId);
}

main()
  .then(() => console.log('Seed complete.'))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
