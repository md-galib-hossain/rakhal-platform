import 'dotenv/config';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Stage-testing fixture accounts (user request 2026-08-09, no ticket #).
 * 2 real-looking Pro-tier users, 2 farms each, each farm carrying a small
 * herd that exercises every `ReproductionState` + a couple of calves — so a
 * fresh `prisma migrate reset && pnpm seed` always hands QA/frontend the same
 * predictable multi-farm, multi-status dataset. Fully idempotent (upsert by
 * fixed id/email), independent of the `owner@demo.rakhal.test` dataset in
 * `seed-demo-data.ts`. Update this file's herd blueprint whenever a schema
 * change touches `Cattle`/`ReproductionProfile`/`BreedingEvent`/`Pregnancy`/
 * `Lactation` — see `CLAUDE.md` "when we update tables we will update the
 * seed data also".
 */

interface TestUserSpec {
  email: string;
  password: string;
  name: string;
  farms: { slug: string; name: string }[];
}

const TEST_USERS: TestUserSpec[] = [
  {
    email: 'mdgalibdev23@gmail.com',
    password: '12345678',
    name: 'MD Galib',
    farms: [
      { slug: 'galib-dairy-1', name: 'Galib Dairy Farm' },
      { slug: 'galib-dairy-2', name: 'Galib Green Pastures' },
    ],
  },
  {
    email: 'mahadihasann@gmail.com',
    password: '12345678',
    name: 'Mahadi Hasan',
    farms: [
      { slug: 'mahadi-dairy-1', name: 'Mahadi Dairy Farm' },
      { slug: 'mahadi-dairy-2', name: 'Mahadi Riverside Farm' },
    ],
  },
];

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number): Date => new Date(Date.now() + n * 86_400_000);

/**
 * One herd per farm covering every `ReproductionState` (RAKHAL-271) plus
 * calves: 2 milking/open cows, 1 pregnant, 1 bred-awaiting-confirmation
 * ("inseminated"), 1 open non-lactating cycling cow, 2 calves.
 */
async function seedHerd(
  prisma: PrismaClient,
  farmId: string,
  ownerId: string,
  prefix: string,
): Promise<void> {
  const existing = await prisma.cattle.count({ where: { farmId } });
  if (existing > 0) return;

  const c1 = `${prefix}_c1`;
  const c2 = `${prefix}_c2`;
  const c3 = `${prefix}_c3`;
  const c4 = `${prefix}_c4`;
  const c5 = `${prefix}_c5`;
  const c6 = `${prefix}_c6`;
  const c7 = `${prefix}_c7`;

  await prisma.cattle.createMany({
    data: [
      {
        id: c1,
        farmId,
        name: 'Lokkhi',
        tagNumber: `${prefix.toUpperCase()}-001`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(1500),
        purpose: 'MILK',
        status: 'ACTIVE',
        productionStatus: 'MILKING',
        lastWeightKg: 400,
        sourceType: 'PURCHASED',
        notes: 'Open — cycling normally after last calving',
        aqrScore: 70,
        createdBy: ownerId,
      },
      {
        id: c2,
        farmId,
        name: 'Shundori',
        tagNumber: `${prefix.toUpperCase()}-002`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(1400),
        purpose: 'MILK',
        status: 'ACTIVE',
        productionStatus: 'MILKING',
        lastWeightKg: 390,
        sourceType: 'PURCHASED',
        notes: 'Open — cycling normally after last calving',
        aqrScore: 66,
        createdBy: ownerId,
      },
      {
        id: c3,
        farmId,
        name: 'Kajol',
        tagNumber: `${prefix.toUpperCase()}-003`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(1800),
        purpose: 'MILK',
        status: 'ACTIVE',
        productionStatus: 'MILKING',
        lastWeightKg: 410,
        sourceType: 'PURCHASED',
        notes: 'Confirmed pregnant, still milking',
        aqrScore: 68,
        createdBy: ownerId,
      },
      {
        id: c4,
        farmId,
        name: 'Moyna',
        tagNumber: `${prefix.toUpperCase()}-004`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(1300),
        purpose: 'MILK',
        status: 'ACTIVE',
        productionStatus: 'MILKING',
        lastWeightKg: 350,
        sourceType: 'PURCHASED',
        notes: 'Inseminated — pregnancy check pending',
        aqrScore: 58,
        createdBy: ownerId,
      },
      {
        id: c5,
        farmId,
        name: 'Bina',
        tagNumber: `${prefix.toUpperCase()}-005`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(1600),
        purpose: 'MILK',
        status: 'ACTIVE',
        productionStatus: 'MILKING',
        lastWeightKg: 380,
        sourceType: 'BORN',
        notes: 'Open, not yet re-bred',
        aqrScore: 60,
        createdBy: ownerId,
      },
      {
        id: c6,
        farmId,
        name: 'Tuni',
        tagNumber: `${prefix.toUpperCase()}-006`,
        gender: 'FEMALE',
        dateOfBirth: daysAgo(30),
        purpose: 'CALF',
        status: 'ACTIVE',
        lastWeightKg: 38,
        motherId: c1,
        sourceType: 'BORN',
        aqrScore: 50,
        createdBy: ownerId,
      },
      {
        id: c7,
        farmId,
        name: 'Bhola',
        tagNumber: `${prefix.toUpperCase()}-007`,
        gender: 'MALE',
        dateOfBirth: daysAgo(50),
        purpose: 'CALF',
        status: 'ACTIVE',
        lastWeightKg: 46,
        motherId: c2,
        sourceType: 'BORN',
        aqrScore: 50,
        createdBy: ownerId,
      },
    ],
  });

  // ---- Lactations (c1, c2, c3, c4, c5 all currently milking) --------------
  await prisma.lactation.createMany({
    data: [
      {
        id: `${prefix}_lact1`,
        cattleId: c1,
        lactationNumber: 2,
        startDate: daysAgo(200),
        peakMilkDate: daysAgo(150),
        status: 'ACTIVE',
      },
      {
        id: `${prefix}_lact2`,
        cattleId: c2,
        lactationNumber: 2,
        startDate: daysAgo(180),
        peakMilkDate: daysAgo(130),
        status: 'ACTIVE',
      },
      {
        id: `${prefix}_lact3`,
        cattleId: c3,
        lactationNumber: 3,
        startDate: daysAgo(90),
        peakMilkDate: daysAgo(40),
        status: 'ACTIVE',
      },
      {
        id: `${prefix}_lact4`,
        cattleId: c4,
        lactationNumber: 1,
        startDate: daysAgo(160),
        peakMilkDate: daysAgo(110),
        status: 'ACTIVE',
      },
      {
        id: `${prefix}_lact5`,
        cattleId: c5,
        lactationNumber: 2,
        startDate: daysAgo(220),
        peakMilkDate: daysAgo(170),
        status: 'ACTIVE',
      },
    ],
  });

  // ---- Breeding events + pregnancy (c3 pregnant, c4 bred-awaiting-check) --
  await prisma.breedingEvent.createMany({
    data: [
      {
        id: `${prefix}_breed3`,
        cattleId: c3,
        breedingDate: daysAgo(90),
        breedingMethod: 'AI',
        inseminator: 'District AI technician',
        breedingNumber: 2,
        expectedPregnancyCheckDate: daysAgo(50),
        status: 'PREGNANT',
        notes: 'Conceived on second service',
      },
      {
        id: `${prefix}_breed4`,
        cattleId: c4,
        breedingDate: daysAgo(18),
        breedingMethod: 'AI',
        inseminator: 'District AI technician',
        breedingNumber: 1,
        expectedPregnancyCheckDate: daysFromNow(12),
        status: 'PENDING_CHECK',
      },
    ],
  });

  await prisma.pregnancy.create({
    data: {
      id: `${prefix}_preg3`,
      cattleId: c3,
      breedingEventId: `${prefix}_breed3`,
      conceptionDate: daysAgo(90),
      expectedCalvingDate: daysFromNow(193),
      calculatedCalvingDate: daysFromNow(193),
      status: 'ACTIVE',
    },
  });

  // ---- Reproduction profiles — one per breeding-aged cow -------------------
  await prisma.reproductionProfile.createMany({
    data: [
      {
        id: `${prefix}_repro1`,
        cattleId: c1,
        reproductiveStatus: 'OPEN',
        currentLactationNumber: 2,
        totalBreedings: 2,
        totalPregnancies: 2,
        totalCalvings: 2,
        firstCalvingDate: daysAgo(600),
        lastCalvingDate: daysAgo(200),
        currentLactationId: `${prefix}_lact1`,
      },
      {
        id: `${prefix}_repro2`,
        cattleId: c2,
        reproductiveStatus: 'OPEN',
        currentLactationNumber: 2,
        totalBreedings: 2,
        totalPregnancies: 2,
        totalCalvings: 2,
        firstCalvingDate: daysAgo(560),
        lastCalvingDate: daysAgo(180),
        currentLactationId: `${prefix}_lact2`,
      },
      {
        id: `${prefix}_repro3`,
        cattleId: c3,
        reproductiveStatus: 'PREGNANT',
        currentLactationNumber: 3,
        totalBreedings: 3,
        totalPregnancies: 3,
        totalCalvings: 2,
        firstCalvingDate: daysAgo(700),
        lastBreedingDate: daysAgo(90),
        lastCalvingDate: daysAgo(90),
        currentPregnancyId: `${prefix}_preg3`,
        currentLactationId: `${prefix}_lact3`,
      },
      {
        id: `${prefix}_repro4`,
        cattleId: c4,
        reproductiveStatus: 'BRED_AWAITING_CONFIRMATION',
        currentLactationNumber: 1,
        totalBreedings: 1,
        totalPregnancies: 0,
        totalCalvings: 1,
        firstCalvingDate: daysAgo(160),
        lastBreedingDate: daysAgo(18),
        lastCalvingDate: daysAgo(160),
        currentLactationId: `${prefix}_lact4`,
      },
      {
        id: `${prefix}_repro5`,
        cattleId: c5,
        reproductiveStatus: 'OPEN',
        currentLactationNumber: 2,
        totalBreedings: 2,
        totalPregnancies: 2,
        totalCalvings: 2,
        firstCalvingDate: daysAgo(650),
        lastCalvingDate: daysAgo(220),
        currentLactationId: `${prefix}_lact5`,
      },
    ],
  });

  console.log(`  ✔ herd seeded for ${prefix} (7 cattle incl. 2 calves)`);
}

async function seedFarmSubscription(
  prisma: PrismaClient,
  farmId: string,
): Promise<void> {
  const existing = await prisma.farmSubscription.findFirst({
    where: { farmId },
  });
  if (existing) return;

  const pro = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Pro' },
    select: { id: true },
  });
  if (!pro) return;

  const now = new Date();
  await prisma.farmSubscription.create({
    data: {
      farmId,
      subscriptionPlanId: pro.id,
      status: SubscriptionStatus.ACTIVE,
      startsAt: now,
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Entry point, called from `seed.ts#main` after roles/plans/legal-docs exist.
 * Requires `seedSubscriptionPlans()` (Pro plan) to have already run.
 */
export async function seedTestAccounts(
  prisma: PrismaClient,
  ownerRoleId: string,
): Promise<void> {
  for (const spec of TEST_USERS) {
    const passwordHash = await argon2.hash(spec.password, {
      type: argon2.argon2id,
    });
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        isEmailVerified: true,
      },
      select: { id: true },
    });

    for (const f of spec.farms) {
      const existingFarm = await prisma.farm.findFirst({
        where: { slug: f.slug },
        select: { id: true },
      });
      const farm =
        existingFarm ??
        (await prisma.farm.create({
          data: {
            name: f.name,
            slug: f.slug,
            ownerId: user.id,
            hasCompletedOnboarding: true,
          },
          select: { id: true },
        }));

      await prisma.farmMember.upsert({
        where: { farmId_userId: { farmId: farm.id, userId: user.id } },
        update: { roleId: ownerRoleId },
        create: { farmId: farm.id, userId: user.id, roleId: ownerRoleId },
      });

      await seedFarmSubscription(prisma, farm.id);
      await seedHerd(prisma, farm.id, user.id, f.slug.replace(/-/g, '_'));
    }

    console.log(
      `✔ test account: ${spec.email} / ${spec.password} — ${spec.farms.length} farms (Pro)`,
    );
  }
}
