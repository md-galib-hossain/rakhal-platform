import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CattleGender,
  CattlePurpose,
  FinanceCategory,
  FinancePaymentMethod,
  FinancePaymentType,
  FinanceTxnStatus,
  FinanceTxnType,
  PrismaClient,
  SubscriptionStatus,
  WalletDirection,
} from '@prisma/client';
import * as argon2 from 'argon2';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  SystemRoleName,
} from '../src/modules/permission/domain/permission-catalogue';
import {
  FEATURE_CATALOGUE,
  PLAN_CATALOGUE,
} from '../src/modules/subscription/domain/subscription-features';

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

async function seedDemo(
  ownerRoleId: string,
): Promise<{ farmId: string; ownerUserId: string }> {
  if (process.env.NODE_ENV === 'production') {
    return { farmId: '', ownerUserId: '' };
  }

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
  return { farmId: farm.id, ownerUserId: user.id };
}

/**
 * Demo Manager + Worker on the demo farm — needed so RBAC is exercisable
 * (and e2e tests can assert owner-vs-worker permission boundaries). Manager and
 * worker were previously created out-of-band; seeding them makes a fresh
 * `pnpm seed` self-sufficient.
 */
async function seedDemoMember(
  email: string,
  name: string,
  password: string,
  farmId: string,
  roleId: string,
): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, isEmailVerified: true },
    select: { id: true },
  });
  await prisma.farmMember.upsert({
    where: { farmId_userId: { farmId, userId: user.id } },
    update: { roleId },
    create: { farmId, userId: user.id, roleId },
  });
  console.log(`✔ demo member: ${email} / ${password} (${name})`);
}

/** Demo platform-admin (RAKHAL-224). Separate identity from farm users. */
async function seedPlatformAdmin(): Promise<void> {
  const email = 'admin@rakhal.test';
  const password = 'AdminPass123';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: {
      email,
      name: 'Rakhal Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`✔ platform admin: ${email} / ${password}`);
}

/**
 * Current legal documents (RAKHAL-236) + the demo owner's acceptance so the
 * consent gate (farm-create / checkout) passes for the seeded demo flows.
 * Admin authoring/publishing UI is RAKHAL-225; these are the seeded v1.0.
 */
async function seedLegalConsent(ownerUserId: string | null): Promise<void> {
  const docs: {
    type: 'TERMS' | 'PRIVACY';
    title: string;
    content: string;
  }[] = [
    {
      type: 'TERMS',
      title: 'Rakhal Terms of Service',
      content:
        'These are the Rakhal Terms of Service (v1.0). By using Rakhal you agree to operate your farm data responsibly and to our subscription terms.',
    },
    {
      type: 'PRIVACY',
      title: 'Rakhal Privacy Policy',
      content:
        'This is the Rakhal Privacy Policy (v1.0). We process your farm and account data to provide the service and never sell it.',
    },
  ];

  const created: { id: string; type: 'TERMS' | 'PRIVACY'; version: string }[] =
    [];
  for (const d of docs) {
    const doc = await prisma.legalDocument.upsert({
      where: { type_version: { type: d.type, version: '1.0' } },
      update: { published: true },
      create: {
        type: d.type,
        version: '1.0',
        title: d.title,
        content: d.content,
        effectiveAt: new Date('2026-01-01T00:00:00Z'),
        published: true,
      },
      select: { id: true, type: true, version: true },
    });
    created.push(doc);
  }
  console.log(`✔ legal documents: ${created.length} (ToS + Privacy v1.0)`);

  if (ownerUserId) {
    for (const doc of created) {
      await prisma.consentRecord.upsert({
        where: {
          userId_documentId: { userId: ownerUserId, documentId: doc.id },
        },
        update: {},
        create: {
          userId: ownerUserId,
          documentId: doc.id,
          documentType: doc.type,
          version: doc.version,
        },
      });
    }
    console.log('✔ demo owner consent: ToS + Privacy accepted');
  }
}

/**
 * A little operational finance data so the dashboard/finance KPIs render
 * meaningfully (not nulls): a wallet credit gives liquidity and a few recent
 * expenses give an average daily burn, so `survivalRunwayDays`/status compute.
 * Idempotent (upsert by reference); dates are relative to run time so they stay
 * inside the trailing-30-day window.
 */
async function seedDemoFinance(
  farmId: string,
  createdBy: string,
): Promise<void> {
  const now = Date.now();
  const daysAgo = (n: number): Date => new Date(now - n * 86_400_000);

  await prisma.walletTransaction.upsert({
    where: { farmId_reference: { farmId, reference: 'SEED-WAL-01' } },
    update: { amount: 300_000, date: daysAgo(40) },
    create: {
      farmId,
      reference: 'SEED-WAL-01',
      direction: WalletDirection.CREDIT,
      amount: 300_000,
      paymentMethod: FinancePaymentMethod.BANK_TRANSFER,
      description: 'Seed: initial working capital',
      date: daysAgo(40),
      createdBy,
    },
  });

  const txns: Array<{
    ref: string;
    type: FinanceTxnType;
    category: FinanceCategory;
    subType: string;
    amount: number;
    days: number;
  }> = [
    { ref: 'SEED-TRX-REV-01', type: FinanceTxnType.REVENUE, category: FinanceCategory.REVENUE, subType: 'milk', amount: 42_000, days: 8 },
    { ref: 'SEED-TRX-EXP-01', type: FinanceTxnType.OPERATING_EXPENSE, category: FinanceCategory.OVERHEAD, subType: 'salary', amount: 12_000, days: 5 },
    { ref: 'SEED-TRX-EXP-02', type: FinanceTxnType.INVENTORY_PURCHASE, category: FinanceCategory.INVENTORY, subType: 'feed', amount: 18_000, days: 12 },
    { ref: 'SEED-TRX-EXP-03', type: FinanceTxnType.OPERATING_EXPENSE, category: FinanceCategory.HEALTHCARE, subType: 'vet', amount: 4_000, days: 20 },
  ];
  for (const t of txns) {
    const data = {
      date: daysAgo(t.days),
      type: t.type,
      category: t.category,
      subType: t.subType,
      amount: t.amount,
      paidNow: t.amount,
      paymentType: FinancePaymentType.FULL,
      paymentMethod: FinancePaymentMethod.CASH,
      status: FinanceTxnStatus.COMPLETED,
      createdBy,
    };
    await prisma.financeTransaction.upsert({
      where: { farmId_reference: { farmId, reference: t.ref } },
      update: data,
      create: { farmId, reference: t.ref, ...data },
    });
  }
  console.log('✔ demo finance: wallet credit + 1 revenue + 3 expenses');
}

/**
 * Global feed-ingredient catalogue (PRD §4.1 / §12.1). These are Rakhal-Admin
 * defaults; until the Admin panel exists (RAKHAL-110) they ship as seeded
 * `isSystemDefault` rows. Values are plausible INRA/NRC/BAU references for common
 * Bangladesh dairy feeds — review/refine with the Admin nutritionist.
 */
async function seedFeedIngredients(): Promise<void> {
  type Ing = {
    id: string;
    nameEn: string;
    nameBn: string;
    category: 'ROUGHAGE' | 'CONCENTRATE' | 'SILAGE' | 'SUPPLEMENT' | 'BY_PRODUCT';
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct: number;
    ndfPct: number;
    price: number;
    source: string;
  };
  const ingredients: Ing[] = [
    { id: 'feed_napier', nameEn: 'Napier grass', nameBn: 'নেপিয়ার ঘাস', category: 'ROUGHAGE', dmPct: 20, cpPct: 9, meMjPerKgDm: 8.5, fatPct: 2, ndfPct: 65, price: 5, source: 'BAU' },
    { id: 'feed_green_maize', nameEn: 'Green maize fodder', nameBn: 'কাঁচা ভুট্টা', category: 'ROUGHAGE', dmPct: 22, cpPct: 9, meMjPerKgDm: 9.5, fatPct: 2.5, ndfPct: 55, price: 6, source: 'INRA 2018' },
    { id: 'feed_rice_straw', nameEn: 'Rice straw', nameBn: 'ধানের খড়', category: 'ROUGHAGE', dmPct: 90, cpPct: 4, meMjPerKgDm: 6.5, fatPct: 1.5, ndfPct: 75, price: 8, source: 'BAU' },
    { id: 'feed_maize_silage', nameEn: 'Maize silage', nameBn: 'ভুট্টা সাইলেজ', category: 'SILAGE', dmPct: 30, cpPct: 8, meMjPerKgDm: 10, fatPct: 3, ndfPct: 45, price: 12, source: 'INRA 2018' },
    { id: 'feed_wheat_bran', nameEn: 'Wheat bran', nameBn: 'গমের ভুসি', category: 'BY_PRODUCT', dmPct: 88, cpPct: 17, meMjPerKgDm: 11.5, fatPct: 4, ndfPct: 40, price: 38, source: 'NRC 2001' },
    { id: 'feed_rice_polish', nameEn: 'Rice polish (bran)', nameBn: 'চালের কুঁড়া', category: 'BY_PRODUCT', dmPct: 90, cpPct: 13, meMjPerKgDm: 11, fatPct: 12, ndfPct: 25, price: 35, source: 'BAU' },
    { id: 'feed_maize_grain', nameEn: 'Maize grain (crushed)', nameBn: 'ভুট্টার দানা', category: 'CONCENTRATE', dmPct: 88, cpPct: 9, meMjPerKgDm: 13.5, fatPct: 4, ndfPct: 11, price: 42, source: 'NRC 2001' },
    { id: 'feed_soybean_meal', nameEn: 'Soybean meal', nameBn: 'সয়াবিন মিল', category: 'CONCENTRATE', dmPct: 90, cpPct: 44, meMjPerKgDm: 12.5, fatPct: 1.5, ndfPct: 13, price: 70, source: 'NRC 2001' },
    { id: 'feed_mustard_cake', nameEn: 'Mustard oil cake', nameBn: 'সরিষার খৈল', category: 'CONCENTRATE', dmPct: 90, cpPct: 32, meMjPerKgDm: 11, fatPct: 9, ndfPct: 30, price: 55, source: 'BAU' },
    { id: 'feed_sesame_cake', nameEn: 'Sesame (til) oil cake', nameBn: 'তিলের খৈল', category: 'CONCENTRATE', dmPct: 92, cpPct: 35, meMjPerKgDm: 11.5, fatPct: 10, ndfPct: 20, price: 60, source: 'BAU' },
    { id: 'feed_khesari_bran', nameEn: 'Khesari (lentil) bran', nameBn: 'খেসারির ভুসি', category: 'BY_PRODUCT', dmPct: 89, cpPct: 18, meMjPerKgDm: 10.5, fatPct: 2, ndfPct: 35, price: 30, source: 'BAU' },
    { id: 'feed_molasses', nameEn: 'Molasses', nameBn: 'চিটাগুড়', category: 'SUPPLEMENT', dmPct: 75, cpPct: 4, meMjPerKgDm: 12.5, fatPct: 0, ndfPct: 0, price: 28, source: 'INRA 2018' },
    { id: 'feed_dcp', nameEn: 'Di-calcium phosphate (DCP)', nameBn: 'ডিসিপি', category: 'SUPPLEMENT', dmPct: 97, cpPct: 0, meMjPerKgDm: 0, fatPct: 0, ndfPct: 0, price: 60, source: 'NRC 2001' },
    { id: 'feed_mineral_mix', nameEn: 'Mineral & vitamin mixture', nameBn: 'মিনারেল মিক্সচার', category: 'SUPPLEMENT', dmPct: 98, cpPct: 0, meMjPerKgDm: 0, fatPct: 0, ndfPct: 0, price: 80, source: 'NRC 2001' },
    { id: 'feed_salt', nameEn: 'Common salt', nameBn: 'খাবার লবণ', category: 'SUPPLEMENT', dmPct: 99, cpPct: 0, meMjPerKgDm: 0, fatPct: 0, ndfPct: 0, price: 15, source: 'NRC 2001' },
  ];

  const now = new Date();
  for (const i of ingredients) {
    const data = {
      nameEn: i.nameEn,
      nameBn: i.nameBn,
      category: i.category,
      dmPct: i.dmPct,
      cpPct: i.cpPct,
      meMjPerKgDm: i.meMjPerKgDm,
      fatPct: i.fatPct,
      ndfPct: i.ndfPct,
      nutritionSource: i.source,
      currentPricePerKg: i.price,
      priceUpdatedAt: now,
      isAvailableBd: true,
      isSystemDefault: true,
      isActive: true,
    };
    await prisma.feedIngredient.upsert({
      where: { id: i.id },
      update: data,
      create: { id: i.id, ...data },
    });
  }
  console.log(`✔ feed ingredients seeded (${ingredients.length})`);
}

/**
 * Default reproductive (synchronization) protocols (RAKHAL-214, PRD §9.8). Global
 * `isSystemDefault` templates (farmId = null) any farm can apply or clone, mirroring
 * the feed-ingredient catalogue seam. Day numbers are protocol day offsets.
 */
async function seedReproProtocols(): Promise<void> {
  type Step = {
    dayNumber: number;
    title: string;
    stepType:
      | 'GNRH'
      | 'PGF2ALPHA'
      | 'CIDR_INSERT'
      | 'CIDR_REMOVE'
      | 'AI'
      | 'PREGNANCY_CHECK'
      | 'OTHER';
  };
  type Protocol = {
    id: string;
    name: string;
    code: string;
    description: string;
    durationDays: number;
    steps: Step[];
  };

  const protocols: Protocol[] = [
    {
      id: 'repro_ovsynch',
      name: 'Ovsynch',
      code: 'OVSYNCH',
      description: 'GnRH → 7d PGF₂α → 2d GnRH → Timed AI (the classic Ovsynch).',
      durationDays: 10,
      steps: [
        { dayNumber: 0, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 7, title: 'PGF₂α injection', stepType: 'PGF2ALPHA' },
        { dayNumber: 9, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 10, title: 'Timed AI', stepType: 'AI' },
        { dayNumber: 40, title: 'Pregnancy check', stepType: 'PREGNANCY_CHECK' },
      ],
    },
    {
      id: 'repro_cidr_synch',
      name: 'CIDR-Synch',
      code: 'CIDR_SYNCH',
      description:
        'CIDR insert + GnRH → 7d remove + PGF₂α → GnRH → Timed AI (progesterone-based).',
      durationDays: 10,
      steps: [
        { dayNumber: 0, title: 'Insert CIDR device', stepType: 'CIDR_INSERT' },
        { dayNumber: 0, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 7, title: 'Remove CIDR device', stepType: 'CIDR_REMOVE' },
        { dayNumber: 7, title: 'PGF₂α injection', stepType: 'PGF2ALPHA' },
        { dayNumber: 9, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 10, title: 'Timed AI', stepType: 'AI' },
        { dayNumber: 40, title: 'Pregnancy check', stepType: 'PREGNANCY_CHECK' },
      ],
    },
    {
      id: 'repro_presynch_ovsynch',
      name: 'Presynch-Ovsynch',
      code: 'PRESYNCH_OVSYNCH',
      description:
        'Two PGF₂α 14 days apart (presynch), then a standard Ovsynch — higher conception in cyclic cows.',
      durationDays: 36,
      steps: [
        { dayNumber: 0, title: 'PGF₂α injection (Presynch 1)', stepType: 'PGF2ALPHA' },
        { dayNumber: 14, title: 'PGF₂α injection (Presynch 2)', stepType: 'PGF2ALPHA' },
        { dayNumber: 26, title: 'GnRH injection (Ovsynch start)', stepType: 'GNRH' },
        { dayNumber: 33, title: 'PGF₂α injection', stepType: 'PGF2ALPHA' },
        { dayNumber: 35, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 36, title: 'Timed AI', stepType: 'AI' },
        { dayNumber: 66, title: 'Pregnancy check', stepType: 'PREGNANCY_CHECK' },
      ],
    },
  ];

  for (const p of protocols) {
    const data = {
      name: p.name,
      code: p.code,
      description: p.description,
      durationDays: p.durationDays,
      isSystemDefault: true,
      isActive: true,
    };
    await prisma.reproProtocol.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
    await prisma.reproProtocolStep.deleteMany({ where: { protocolId: p.id } });
    await prisma.reproProtocolStep.createMany({
      data: p.steps.map((s) => ({ protocolId: p.id, ...s })),
    });
  }
  console.log(`✔ repro protocols: ${protocols.length} system defaults`);
}

/**
 * Subscription plan catalogue (RAKHAL-217, PRD §31.1). Idempotent: upserts the
 * `Feature` catalogue + Free/Starter/Pro `SubscriptionPlan`s, then resets each
 * plan's `SubscriptionFeature` matrix to exactly match `subscription-features.ts`.
 */
async function seedSubscriptionPlans(): Promise<void> {
  for (const f of FEATURE_CATALOGUE) {
    await prisma.feature.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: { key: f.key, description: f.description },
    });
  }

  const featureIdByKey = new Map(
    (
      await prisma.feature.findMany({ select: { id: true, key: true } })
    ).map((f) => [f.key, f.id] as const),
  );

  for (const plan of PLAN_CATALOGUE) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name: plan.name },
    });
    const data = {
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxCattle: plan.maxCattle,
      maxFarmMembers: plan.maxFarmMembers,
    };
    const row = existing
      ? await prisma.subscriptionPlan.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.subscriptionPlan.create({
          data: { name: plan.name, ...data },
        });

    // Reset the plan↔feature matrix to exactly match the catalogue.
    await prisma.subscriptionFeature.deleteMany({
      where: { subscriptionPlanId: row.id },
    });
    await prisma.subscriptionFeature.createMany({
      data: plan.features
        .map((key) => featureIdByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((featureId) => ({
          subscriptionPlanId: row.id,
          featureId,
          enabled: true,
        })),
    });
  }
}

/**
 * Give the demo farm an ACTIVE Pro subscription (unlimited, 1-year) so demo +
 * e2e flows retain full feature access once the subscription gate lands
 * (RAKHAL-218). Idempotent; requires `seedSubscriptionPlans()` to have run.
 */
async function seedDemoSubscription(farmId: string): Promise<void> {
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
  console.log('✔ demo subscription: ACTIVE Pro (1 year)');
}

/**
 * Demo herd (RAKHAL-256 test-infra fix). Several e2e specs (reproduction
 * protocols, scoreboard, notification emitters) fetch `GET /cattle` and operate
 * on the demo farm's animals — they previously relied on cattle left behind by
 * earlier runs. Seed a small stable herd so the suite is reproducible from a
 * clean `pnpm seed` / `prisma migrate reset`. Idempotent (skips if any exist).
 */
async function seedDemoCattle(farmId: string, createdBy: string): Promise<void> {
  const existing = await prisma.cattle.count({ where: { farmId } });
  if (existing > 0) return;

  await prisma.cattle.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      farmId,
      tagNumber: `DEMO-${String(i + 1).padStart(3, '0')}`,
      gender: i < 6 ? CattleGender.FEMALE : CattleGender.MALE,
      purpose: i < 6 ? CattlePurpose.MILK : CattlePurpose.BREEDING,
      aqrScore: 50,
      createdBy,
    })),
  });
  console.log('✔ demo cattle seeded (8)');
}

async function main(): Promise<void> {
  await seedPermissions();
  const ownerRoleId = await seedRole(SYSTEM_ROLES.OWNER);
  const managerRoleId = await seedRole(SYSTEM_ROLES.MANAGER);
  const workerRoleId = await seedRole(SYSTEM_ROLES.WORKER);
  const demo = await seedDemo(ownerRoleId);
  if (demo.farmId) {
    await seedDemoMember(
      'manager@demo.rakhal.test',
      'Demo Manager',
      'ManagerPass123',
      demo.farmId,
      managerRoleId,
    );
    await seedDemoMember(
      'worker@demo.rakhal.test',
      'Demo Worker',
      'WorkerPass123',
      demo.farmId,
      workerRoleId,
    );
    await seedDemoFinance(demo.farmId, demo.ownerUserId);
    await seedDemoCattle(demo.farmId, demo.ownerUserId);
  }
  await seedFeedIngredients();
  await seedReproProtocols();
  await seedSubscriptionPlans();
  await seedPlatformAdmin();
  await seedLegalConsent(demo.ownerUserId ?? null);
  if (demo.farmId) {
    await seedDemoSubscription(demo.farmId);
  }
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
