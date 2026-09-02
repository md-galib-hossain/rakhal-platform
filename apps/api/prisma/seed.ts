import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BreedingMethod,
  BreedingStatus,
  CattleGender,
  FinancialAccountType,
  LedgerAccountCategory,
  MilkDisposition,
  MilkSession,
  MilkTankType,
  PaymentDirection,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SaleLineType,
  SaleStatus,
  SubscriptionStatus,
  UnitDimension,
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
import { DEFAULT_CHART_OF_ACCOUNTS } from '../src/modules/finance-v2/ledger/domain/default-chart-of-accounts';
import { isAnomaly } from '../src/modules/milk/domain/milk-anomaly';
import { seedDemoDataset } from './seed-demo-data';
import { seedTestAccounts } from './seed-test-accounts';

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

/**
 * Demo platform-admin (RAKHAL-224). Separate identity from farm users.
 * **2FA pre-enabled with a fixed, well-known test secret** (RAKHAL-225 — 2FA is
 * mandatory, and e2e/dev tooling needs a deterministic secret to compute a live
 * TOTP code without going through the interactive setup flow). Never a real
 * production admin credential.
 */
const DEMO_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

async function seedPlatformAdmin(): Promise<void> {
  const email = 'admin@rakhal.test';
  const password = 'AdminPass123';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.platformAdmin.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      totpEnabled: true,
      totpSecret: DEMO_ADMIN_TOTP_SECRET,
    },
    create: {
      email,
      name: 'Rakhal Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      totpEnabled: true,
      totpSecret: DEMO_ADMIN_TOTP_SECRET,
    },
  });
  console.log(
    `✔ platform admin: ${email} / ${password} (2FA secret: ${DEMO_ADMIN_TOTP_SECRET})`,
  );
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
 * Finance V2 chart of accounts (RAKHAL-333, `FINANCE_V2_DESIGN.md` §4.4) for
 * the demo farm. Mirrors `LedgerAccountService.seedDefaultChart` — this
 * standalone seed script uses raw `PrismaClient` rather than the Nest
 * service, so the write is inlined here, but the account list itself is
 * imported (not duplicated) from the shared domain constant. Idempotent
 * (`skipDuplicates` against `@@unique([farmId, code])`).
 */
async function seedLedgerAccounts(farmId: string): Promise<void> {
  const result = await prisma.ledgerAccount.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      farmId,
      category: account.category,
      code: account.code,
      name: account.name,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
  console.log(
    `✔ ledger accounts (finance-v2): farmId=${farmId} created=${result.count}`,
  );
}

/**
 * RAKHAL-354 finance-v2 seed helpers. Standalone `PrismaClient` script (no
 * Nest DI), so these are thin, raw-Prisma stand-ins for
 * `LedgerAccountService.findByCode`/`FinancialAccountService.createAccount`/
 * `JournalService.postJournal` — same shape, deliberately not imported
 * directly (those services expect a Nest-injected `PrismaService`, not this
 * script's bare `PrismaClient`).
 */
async function seedLedgerAccountId(
  farmId: string,
  code: string,
): Promise<string> {
  const account = await prisma.ledgerAccount.findFirst({
    where: { farmId, code },
    select: { id: true },
  });
  if (!account) {
    throw new Error(
      `Seed: ledger account ${code} not found for farm ${farmId} — run seedLedgerAccounts first`,
    );
  }
  return account.id;
}

/** Mirrors `FinancialAccountService`'s custom-code allocator
 * (`nextCustomLedgerCode`, `finance-v2/accounts/application/financial-account.service.ts`)
 * exactly — same `FarmCounter` scope key — so a farm's later real
 * `POST /finance/accounts` calls never collide with a seed-allocated code. */
async function seedNextCustomLedgerCode(farmId: string): Promise<string> {
  const counter = await prisma.farmCounter.upsert({
    where: { scope: `finance-v2-account:${farmId}` },
    create: { scope: `finance-v2-account:${farmId}`, value: 9000 },
    update: { value: { increment: 1 } },
  });
  return String(counter.value);
}

async function seedFinancialAccount(
  farmId: string,
  userId: string,
  name: string,
  type: FinancialAccountType,
  openingBalance: number,
  openingDate: Date,
): Promise<{ id: string; ledgerAccountId: string }> {
  const existing = await prisma.financialAccount.findFirst({
    where: { farmId, name },
    select: { id: true, ledgerAccountId: true },
  });
  if (existing) return existing;

  const code = await seedNextCustomLedgerCode(farmId);
  const ledgerAccount = await prisma.ledgerAccount.create({
    data: {
      farmId,
      category: LedgerAccountCategory.ASSET,
      code,
      name,
      isSystem: false,
    },
  });
  const account = await prisma.financialAccount.create({
    data: {
      farmId,
      name,
      type,
      ledgerAccountId: ledgerAccount.id,
      createdById: userId,
    },
  });

  if (openingBalance > 0) {
    const equityAccountId = await seedLedgerAccountId(farmId, '3000');
    await seedPostJournal(
      farmId,
      userId,
      'FINANCIAL_ACCOUNT_OPENING_BALANCE',
      account.id,
      openingDate,
      `Opening balance for ${name}`,
      `financial-account-opening-balance:${account.id}`,
      [
        { ledgerAccountId: ledgerAccount.id, debit: openingBalance },
        { ledgerAccountId: equityAccountId, credit: openingBalance },
      ],
    );
  }
  return { id: account.id, ledgerAccountId: ledgerAccount.id };
}

/** Mirrors `JournalService.postJournal` — a balanced double-entry posting.
 * Idempotent by `(farmId, idempotencyKey)`, same convention the real
 * service uses, so re-running `pnpm seed` never double-posts. */
async function seedPostJournal(
  farmId: string,
  userId: string,
  sourceType: string,
  sourceId: string,
  date: Date,
  description: string,
  idempotencyKey: string,
  entries: Array<{ ledgerAccountId: string; debit?: number; credit?: number }>,
): Promise<string> {
  const existing = await prisma.journalTransaction.findUnique({
    where: { farmId_idempotencyKey: { farmId, idempotencyKey } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const totalDebit = entries.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    throw new Error(
      `Seed: unbalanced journal posting ${idempotencyKey} (debit ${totalDebit} != credit ${totalCredit})`,
    );
  }

  const txn = await prisma.journalTransaction.create({
    data: {
      farmId,
      sourceType,
      sourceId,
      transactionDate: date,
      description,
      idempotencyKey,
      createdById: userId,
      entries: {
        create: entries.map((e) => ({
          ledgerAccountId: e.ledgerAccountId,
          debit: new Prisma.Decimal(e.debit ?? 0),
          credit: new Prisma.Decimal(e.credit ?? 0),
        })),
      },
    },
  });
  return txn.id;
}

/**
 * A little operational finance data so the dashboard/finance KPIs render
 * meaningfully (not nulls): two `FinancialAccount`s (Cash/Bank) with opening
 * balances give liquidity, and a few recent postings give an average daily
 * burn, so `survivalRunwayDays`/status (`computeRunwaySnapshot`) compute.
 *
 * RAKHAL-354: rewritten off V1 `WalletTransaction`/`FinanceTransaction`
 * (dropped) onto real Finance V2 `FinancialAccount`/`JournalTransaction`
 * postings — same balanced double-entry every other V2 write case produces,
 * hand-written here since this script has no Nest DI to call
 * `ExpenseService`/`IncomeService` directly. Idempotent (by name for
 * accounts, by `idempotencyKey` for postings); dates are relative to run
 * time so they stay inside the trailing-30-day window.
 */
async function seedDemoFinance(
  farmId: string,
  createdBy: string,
): Promise<void> {
  const now = Date.now();
  const daysAgo = (n: number): Date => new Date(now - n * 86_400_000);

  const cash = await seedFinancialAccount(
    farmId,
    createdBy,
    'Cash',
    FinancialAccountType.CASH,
    300_000,
    daysAgo(40),
  );
  const bank = await seedFinancialAccount(
    farmId,
    createdBy,
    'Bank',
    FinancialAccountType.BANK,
    100_000,
    daysAgo(40),
  );

  const milkSalesId = await seedLedgerAccountId(farmId, '4000');
  const salaryId = await seedLedgerAccountId(farmId, '5200');
  const feedId = await seedLedgerAccountId(farmId, '5000');
  const medicineId = await seedLedgerAccountId(farmId, '5100');

  // Revenue: milk sale settled into Cash.
  await seedPostJournal(
    farmId,
    createdBy,
    'SEED_OTHER_INCOME',
    'seed-rev-01',
    daysAgo(8),
    'Seed: milk dispatch payment',
    'seed-finance:rev-01',
    [
      { ledgerAccountId: cash.ledgerAccountId, debit: 42_000 },
      { ledgerAccountId: milkSalesId, credit: 42_000 },
    ],
  );
  // Expense: salary paid from Cash.
  await seedPostJournal(
    farmId,
    createdBy,
    'SEED_EXPENSE',
    'seed-exp-01',
    daysAgo(5),
    'Seed: staff salary',
    'seed-finance:exp-01',
    [
      { ledgerAccountId: salaryId, debit: 12_000 },
      { ledgerAccountId: cash.ledgerAccountId, credit: 12_000 },
    ],
  );
  // Expense: feed purchase paid from Bank.
  await seedPostJournal(
    farmId,
    createdBy,
    'SEED_EXPENSE',
    'seed-exp-02',
    daysAgo(12),
    'Seed: feed purchase',
    'seed-finance:exp-02',
    [
      { ledgerAccountId: feedId, debit: 18_000 },
      { ledgerAccountId: bank.ledgerAccountId, credit: 18_000 },
    ],
  );
  // Expense: vet visit paid from Cash.
  await seedPostJournal(
    farmId,
    createdBy,
    'SEED_EXPENSE',
    'seed-exp-03',
    daysAgo(20),
    'Seed: vet visit',
    'seed-finance:exp-03',
    [
      { ledgerAccountId: medicineId, debit: 4_000 },
      { ledgerAccountId: cash.ledgerAccountId, credit: 4_000 },
    ],
  );

  console.log(
    '✔ demo finance (v2): Cash + Bank accounts (opening balances) + 1 revenue + 3 expense postings',
  );
}

/**
 * Global unit catalogue (RAKHAL-326) — replaces the free-text `unit` string previously
 * stored directly on Medicine/Equipment/FeedItem. `isSystemDefault` rows, `farmId: null`,
 * visible to every farm; a farm can additionally create its own custom `Unit` row (`farmId`
 * set) via `POST /inventory/units`. Same "system catalogue + farm-custom rows" seam as
 * `seedFeedIngredients` below. Stable ids so re-seeding is idempotent.
 */
async function seedUnits(): Promise<void> {
  type UnitDef = {
    id: string;
    name: string;
    symbol: string;
    dimension: UnitDimension;
    conversionToBase: number | null;
  };
  const units: UnitDef[] = [
    // WEIGHT — base unit is kg (factor 1).
    {
      id: 'unit_kg',
      name: 'Kilogram',
      symbol: 'kg',
      dimension: 'WEIGHT',
      conversionToBase: 1,
    },
    {
      id: 'unit_g',
      name: 'Gram',
      symbol: 'g',
      dimension: 'WEIGHT',
      conversionToBase: 0.001,
    },
    {
      id: 'unit_ton',
      name: 'Ton',
      symbol: 'ton',
      dimension: 'WEIGHT',
      conversionToBase: 1000,
    },
    // VOLUME — base unit is L (factor 1).
    {
      id: 'unit_l',
      name: 'Litre',
      symbol: 'L',
      dimension: 'VOLUME',
      conversionToBase: 1,
    },
    {
      id: 'unit_ml',
      name: 'Millilitre',
      symbol: 'mL',
      dimension: 'VOLUME',
      conversionToBase: 0.001,
    },
    // COUNT — no inherent weight/volume, conversionToBase stays null.
    {
      id: 'unit_pcs',
      name: 'Pieces',
      symbol: 'pcs',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_bag',
      name: 'Bag',
      symbol: 'bag',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_sack',
      name: 'Sack',
      symbol: 'sack',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_bale',
      name: 'Bale',
      symbol: 'bale',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_box',
      name: 'Box',
      symbol: 'box',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_bottle',
      name: 'Bottle',
      symbol: 'bottle',
      dimension: 'COUNT',
      conversionToBase: null,
    },
    {
      id: 'unit_dose',
      name: 'Dose',
      symbol: 'dose',
      dimension: 'COUNT',
      conversionToBase: null,
    },
  ];

  for (const u of units) {
    const data = {
      name: u.name,
      symbol: u.symbol,
      dimension: u.dimension,
      conversionToBase: u.conversionToBase,
      isSystemDefault: true,
      deletedAt: null,
    };
    await prisma.unit.upsert({
      where: { id: u.id },
      update: data,
      create: { id: u.id, ...data },
    });
  }
  console.log(`✔ units seeded (${units.length})`);
}

/**
 * Global `IncomeCategory` catalogue (RAKHAL-350, `FINANCE_V2_DESIGN.md`
 * §1.3, §5.1). Same "system catalogue + farm-custom rows" convention as
 * `seedUnits` above (RAKHAL-326) — `farmId: null`, `isSystem: true`, visible
 * to every farm; a farm can additionally add its own custom category via
 * `POST /finance/income/categories`. Stable ids so re-seeding is idempotent.
 */
async function seedIncomeCategories(): Promise<void> {
  const categories: Array<{ id: string; name: string }> = [
    { id: 'income_category_government_subsidy', name: 'Government Subsidy' },
    { id: 'income_category_insurance', name: 'Insurance' },
    { id: 'income_category_rent', name: 'Rent' },
    { id: 'income_category_service_income', name: 'Service Income' },
    { id: 'income_category_interest', name: 'Interest' },
    { id: 'income_category_compensation', name: 'Compensation' },
    { id: 'income_category_miscellaneous', name: 'Miscellaneous' },
  ];

  for (const c of categories) {
    const data = { name: c.name, isSystem: true, farmId: null };
    await prisma.incomeCategory.upsert({
      where: { id: c.id },
      update: data,
      create: { id: c.id, ...data },
    });
  }
  console.log(`✔ income categories seeded (${categories.length})`);
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
    feedClass: 'FORAGE' | 'CONCENTRATE' | 'MINERAL';
    feedSubType:
      | 'ROUGHAGE'
      | 'SILAGE'
      | 'GRAIN'
      | 'BY_PRODUCT'
      | 'SUPPLEMENT'
      | 'PREMIX'
      | 'OTHER';
    dmPct: number;
    cpPct: number;
    meMjPerKgDm: number;
    fatPct: number;
    ndfPct: number;
    price: number;
    source: string;
  };
  // feedClass/feedSubType replace the old ROUGHAGE/CONCENTRATE/SILAGE/SUPPLEMENT/BY_PRODUCT
  // category (feed_taxonomy_unification) — dcp/mineral_mix/salt were previously mistagged
  // SUPPLEMENT for lack of a MINERAL category; now correctly FORAGE is the umbrella-consistent
  // class name for roughage/silage, and minerals get their own class.
  const ingredients: Ing[] = [
    {
      id: 'feed_napier',
      nameEn: 'Napier grass',
      nameBn: 'নেপিয়ার ঘাস',
      feedClass: 'FORAGE',
      feedSubType: 'ROUGHAGE',
      dmPct: 20,
      cpPct: 9,
      meMjPerKgDm: 8.5,
      fatPct: 2,
      ndfPct: 65,
      price: 5,
      source: 'BAU',
    },
    {
      id: 'feed_green_maize',
      nameEn: 'Green maize fodder',
      nameBn: 'কাঁচা ভুট্টা',
      feedClass: 'FORAGE',
      feedSubType: 'ROUGHAGE',
      dmPct: 22,
      cpPct: 9,
      meMjPerKgDm: 9.5,
      fatPct: 2.5,
      ndfPct: 55,
      price: 6,
      source: 'INRA 2018',
    },
    {
      id: 'feed_rice_straw',
      nameEn: 'Rice straw',
      nameBn: 'ধানের খড়',
      feedClass: 'FORAGE',
      feedSubType: 'ROUGHAGE',
      dmPct: 90,
      cpPct: 4,
      meMjPerKgDm: 6.5,
      fatPct: 1.5,
      ndfPct: 75,
      price: 8,
      source: 'BAU',
    },
    {
      id: 'feed_maize_silage',
      nameEn: 'Maize silage',
      nameBn: 'ভুট্টা সাইলেজ',
      feedClass: 'FORAGE',
      feedSubType: 'SILAGE',
      dmPct: 30,
      cpPct: 8,
      meMjPerKgDm: 10,
      fatPct: 3,
      ndfPct: 45,
      price: 12,
      source: 'INRA 2018',
    },
    {
      id: 'feed_wheat_bran',
      nameEn: 'Wheat bran',
      nameBn: 'গমের ভুসি',
      feedClass: 'CONCENTRATE',
      feedSubType: 'BY_PRODUCT',
      dmPct: 88,
      cpPct: 17,
      meMjPerKgDm: 11.5,
      fatPct: 4,
      ndfPct: 40,
      price: 38,
      source: 'NRC 2001',
    },
    {
      id: 'feed_rice_polish',
      nameEn: 'Rice polish (bran)',
      nameBn: 'চালের কুঁড়া',
      feedClass: 'CONCENTRATE',
      feedSubType: 'BY_PRODUCT',
      dmPct: 90,
      cpPct: 13,
      meMjPerKgDm: 11,
      fatPct: 12,
      ndfPct: 25,
      price: 35,
      source: 'BAU',
    },
    {
      id: 'feed_maize_grain',
      nameEn: 'Maize grain (crushed)',
      nameBn: 'ভুট্টার দানা',
      feedClass: 'CONCENTRATE',
      feedSubType: 'GRAIN',
      dmPct: 88,
      cpPct: 9,
      meMjPerKgDm: 13.5,
      fatPct: 4,
      ndfPct: 11,
      price: 42,
      source: 'NRC 2001',
    },
    {
      id: 'feed_soybean_meal',
      nameEn: 'Soybean meal',
      nameBn: 'সয়াবিন মিল',
      feedClass: 'CONCENTRATE',
      feedSubType: 'GRAIN',
      dmPct: 90,
      cpPct: 44,
      meMjPerKgDm: 12.5,
      fatPct: 1.5,
      ndfPct: 13,
      price: 70,
      source: 'NRC 2001',
    },
    {
      id: 'feed_mustard_cake',
      nameEn: 'Mustard oil cake',
      nameBn: 'সরিষার খৈল',
      feedClass: 'CONCENTRATE',
      feedSubType: 'GRAIN',
      dmPct: 90,
      cpPct: 32,
      meMjPerKgDm: 11,
      fatPct: 9,
      ndfPct: 30,
      price: 55,
      source: 'BAU',
    },
    {
      id: 'feed_sesame_cake',
      nameEn: 'Sesame (til) oil cake',
      nameBn: 'তিলের খৈল',
      feedClass: 'CONCENTRATE',
      feedSubType: 'GRAIN',
      dmPct: 92,
      cpPct: 35,
      meMjPerKgDm: 11.5,
      fatPct: 10,
      ndfPct: 20,
      price: 60,
      source: 'BAU',
    },
    {
      id: 'feed_khesari_bran',
      nameEn: 'Khesari (lentil) bran',
      nameBn: 'খেসারির ভুসি',
      feedClass: 'CONCENTRATE',
      feedSubType: 'BY_PRODUCT',
      dmPct: 89,
      cpPct: 18,
      meMjPerKgDm: 10.5,
      fatPct: 2,
      ndfPct: 35,
      price: 30,
      source: 'BAU',
    },
    {
      id: 'feed_molasses',
      nameEn: 'Molasses',
      nameBn: 'চিটাগুড়',
      feedClass: 'CONCENTRATE',
      feedSubType: 'SUPPLEMENT',
      dmPct: 75,
      cpPct: 4,
      meMjPerKgDm: 12.5,
      fatPct: 0,
      ndfPct: 0,
      price: 28,
      source: 'INRA 2018',
    },
    {
      id: 'feed_dcp',
      nameEn: 'Di-calcium phosphate (DCP)',
      nameBn: 'ডিসিপি',
      feedClass: 'MINERAL',
      feedSubType: 'PREMIX',
      dmPct: 97,
      cpPct: 0,
      meMjPerKgDm: 0,
      fatPct: 0,
      ndfPct: 0,
      price: 60,
      source: 'NRC 2001',
    },
    {
      id: 'feed_mineral_mix',
      nameEn: 'Mineral & vitamin mixture',
      nameBn: 'মিনারেল মিক্সচার',
      feedClass: 'MINERAL',
      feedSubType: 'PREMIX',
      dmPct: 98,
      cpPct: 0,
      meMjPerKgDm: 0,
      fatPct: 0,
      ndfPct: 0,
      price: 80,
      source: 'NRC 2001',
    },
    {
      id: 'feed_salt',
      nameEn: 'Common salt',
      nameBn: 'খাবার লবণ',
      feedClass: 'MINERAL',
      feedSubType: 'OTHER',
      dmPct: 99,
      cpPct: 0,
      meMjPerKgDm: 0,
      fatPct: 0,
      ndfPct: 0,
      price: 15,
      source: 'NRC 2001',
    },
  ];

  const now = new Date();
  for (const i of ingredients) {
    const data = {
      nameEn: i.nameEn,
      nameBn: i.nameBn,
      feedClass: i.feedClass,
      feedSubType: i.feedSubType,
      dmPct: i.dmPct,
      cpPct: i.cpPct,
      meMjPerKgDm: i.meMjPerKgDm,
      fatPct: i.fatPct,
      ndfPct: i.ndfPct,
      nutritionSourceNote: i.source,
      nutritionSource: 'REFERENCE' as const,
      currentPricePerKg: i.price,
      priceUpdatedAt: now,
      isAvailableBd: true,
      isSystemDefault: true,
      deletedAt: null,
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
      description:
        'GnRH → 7d PGF₂α → 2d GnRH → Timed AI (the classic Ovsynch).',
      durationDays: 10,
      steps: [
        { dayNumber: 0, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 7, title: 'PGF₂α injection', stepType: 'PGF2ALPHA' },
        { dayNumber: 9, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 10, title: 'Timed AI', stepType: 'AI' },
        {
          dayNumber: 40,
          title: 'Pregnancy check',
          stepType: 'PREGNANCY_CHECK',
        },
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
        {
          dayNumber: 40,
          title: 'Pregnancy check',
          stepType: 'PREGNANCY_CHECK',
        },
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
        {
          dayNumber: 0,
          title: 'PGF₂α injection (Presynch 1)',
          stepType: 'PGF2ALPHA',
        },
        {
          dayNumber: 14,
          title: 'PGF₂α injection (Presynch 2)',
          stepType: 'PGF2ALPHA',
        },
        {
          dayNumber: 26,
          title: 'GnRH injection (Ovsynch start)',
          stepType: 'GNRH',
        },
        { dayNumber: 33, title: 'PGF₂α injection', stepType: 'PGF2ALPHA' },
        { dayNumber: 35, title: 'GnRH injection', stepType: 'GNRH' },
        { dayNumber: 36, title: 'Timed AI', stepType: 'AI' },
        {
          dayNumber: 66,
          title: 'Pregnancy check',
          stepType: 'PREGNANCY_CHECK',
        },
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
      deletedAt: null,
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
    (await prisma.feature.findMany({ select: { id: true, key: true } })).map(
      (f) => [f.key, f.id] as const,
    ),
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
 * Ensure the gapless invoice-number counter row exists (RAKHAL-237, TAX-02) so
 * every checkout hits the atomic `increment` path — never the create branch (which
 * could race under concurrency). Idempotent: seeded at value 0, never reset.
 */
async function seedInvoiceCounter(): Promise<void> {
  await prisma.invoiceCounter.upsert({
    where: { scope: 'invoice' },
    update: {},
    create: { scope: 'invoice', value: 0 },
  });
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
async function seedDemoCattle(
  farmId: string,
  createdBy: string,
): Promise<void> {
  const existing = await prisma.cattle.count({ where: { farmId } });
  if (existing > 0) return;

  await prisma.cattle.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      farmId,
      tagNumber: `DEMO-${String(i + 1).padStart(3, '0')}`,
      gender: i < 6 ? CattleGender.FEMALE : CattleGender.MALE,
      aqrScore: 50,
      createdBy,
    })),
  });
  console.log('✔ demo cattle seeded (8)');
}

/**
 * 12 months of history so the dashboard's 3 trend charts (Financial
 * Performance / Production vs Feedcost / Conception Rate —
 * `dashboard.service.ts#financialPerformance/productionVsFeedcost/conceptionRate`)
 * render a real curve instead of a flat line. Idempotent (upsert by
 * reference / unique key); deterministic wave-shaped values, not random, so
 * re-running `pnpm seed` doesn't reshuffle the chart on every run.
 */
async function seedDemoDashboardHistory(
  farmId: string,
  createdBy: string,
): Promise<void> {
  const now = new Date();

  // ---- Financial Performance: 12 monthly income/expense postings -----------
  // RAKHAL-354: rewritten off V1 `FinanceTransaction` (dropped) onto balanced
  // V2 `JournalTransaction` postings against Cash + the seeded chart of
  // accounts — `dashboard.service.ts#financialPerformance` now reads
  // `JournalEntry` exclusively (V1 dropped, no longer an additive V1+V2 read).
  const cashForHistory = await seedFinancialAccount(
    farmId,
    createdBy,
    'Cash',
    FinancialAccountType.CASH,
    0,
    now,
  );
  const milkSalesIdForHistory = await seedLedgerAccountId(farmId, '4000');
  const salaryIdForHistory = await seedLedgerAccountId(farmId, '5200');
  for (let i = 11; i >= 0; i -= 1) {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 5),
    );
    const wave = Math.sin(((11 - i) / 11) * Math.PI * 1.5);
    const income = Math.round(150_000 + wave * 90_000);
    const expense = Math.round(
      120_000 + Math.cos(((11 - i) / 11) * Math.PI) * 60_000,
    );
    const key = monthStart.toISOString().slice(0, 7);

    await seedPostJournal(
      farmId,
      createdBy,
      'SEED_OTHER_INCOME',
      `seed-hist-rev-${key}`,
      monthStart,
      `Seed: monthly milk revenue ${key}`,
      `seed-finance:hist-rev-${key}`,
      [
        { ledgerAccountId: cashForHistory.ledgerAccountId, debit: income },
        { ledgerAccountId: milkSalesIdForHistory, credit: income },
      ],
    );
    await seedPostJournal(
      farmId,
      createdBy,
      'SEED_EXPENSE',
      `seed-hist-exp-${key}`,
      monthStart,
      `Seed: monthly salary ${key}`,
      `seed-finance:hist-exp-${key}`,
      [
        { ledgerAccountId: salaryIdForHistory, debit: expense },
        { ledgerAccountId: cashForHistory.ledgerAccountId, credit: expense },
      ],
    );
  }
  console.log('✔ demo finance history (v2): 12 monthly income/expense pairs');

  // ---- Production vs Feedcost: current-month daily milk + feed cost -------
  const milkCows = await prisma.cattle.findMany({
    where: { farmId, gender: CattleGender.FEMALE },
    select: { id: true },
    take: 6,
  });

  // ---- Sale + Receivable (RAKHAL-354 AC: "accounts, sales, receivables and
  // a balanced ledger") — a real animal sale, partially paid, so both
  // `GET /sales` and `GET /finance/receivables`-equivalent (V2's
  // `Receivable`) surfaces have a non-empty demo row. Not JSON-fixture-
  // driven (no `sales.json`/`receivables.json` exists) — hand-written here,
  // same standalone-script constraint every other helper in this section
  // documents. Idempotent by `Sale.saleNumber`.
  if (milkCows.length > 0) {
    const saleTotal = 45_000;
    const paidNow = 20_000;
    const saleDate = now;
    const existingSale = await prisma.sale.findFirst({
      where: { farmId, saleNumber: 'SEED-SALE-0001' },
      select: { id: true },
    });
    if (!existingSale) {
      const sale = await prisma.sale.create({
        data: {
          farmId,
          saleNumber: 'SEED-SALE-0001',
          saleDate,
          subtotal: saleTotal,
          totalAmount: saleTotal,
          status: SaleStatus.CONFIRMED,
          notes: 'Seed: demo animal sale',
          createdById: createdBy,
          lines: {
            create: [
              {
                type: SaleLineType.ANIMAL,
                description: 'Demo animal sale',
                quantity: 1,
                unitPrice: saleTotal,
                totalAmount: saleTotal,
              },
            ],
          },
        },
        include: { lines: true },
      });
      await prisma.animalSaleLine.create({
        data: { saleLineId: sale.lines[0].id, cattleId: milkCows[0].id },
      });

      const receivableId = 'seed-receivable-0001';
      await prisma.receivable.create({
        data: {
          id: receivableId,
          farmId,
          saleId: sale.id,
          totalAmount: saleTotal,
          dueDate: new Date(now.getTime() + 14 * 86_400_000),
        },
      });

      const arId = await seedLedgerAccountId(farmId, '1100');
      const animalSalesId = await seedLedgerAccountId(farmId, '4100');
      await seedPostJournal(
        farmId,
        createdBy,
        'SALE',
        sale.id,
        saleDate,
        `Sale ${sale.saleNumber}`,
        `sale:${sale.id}`,
        [
          { ledgerAccountId: arId, debit: saleTotal },
          { ledgerAccountId: animalSalesId, credit: saleTotal },
        ],
      );

      // Partial payment — leaves a real outstanding balance on the
      // Receivable (RAKHAL-340's `PARTIALLY_PAID` status, derived not
      // stored) so the demo farm's receivables list isn't all-or-nothing.
      const cashForSale = await seedFinancialAccount(
        farmId,
        createdBy,
        'Cash',
        FinancialAccountType.CASH,
        0,
        now,
      );
      const payment = await prisma.financePayment.create({
        data: {
          farmId,
          direction: PaymentDirection.INCOMING,
          financialAccountId: cashForSale.id,
          amount: paidNow,
          method: PaymentMethod.CASH,
          transactionDate: now,
          referenceNumber: 'SEED-PAY-0001',
          createdById: createdBy,
        },
      });
      await prisma.paymentAllocation.create({
        data: { paymentId: payment.id, receivableId, amount: paidNow },
      });
      await seedPostJournal(
        farmId,
        createdBy,
        'PAYMENT',
        payment.id,
        now,
        `Payment ${payment.id} (INCOMING)`,
        `payment:${payment.id}`,
        [
          { ledgerAccountId: cashForSale.ledgerAccountId, debit: paidNow },
          { ledgerAccountId: arId, credit: paidNow },
        ],
      );
      console.log(
        `✔ demo sale + receivable (v2): SEED-SALE-0001 ৳${saleTotal}, paid ৳${paidNow}, outstanding ৳${saleTotal - paidNow}`,
      );
    }
  }

  if (milkCows.length > 0) {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const daysSoFar = now.getUTCDate();

    let concentration = await prisma.feedConcentration.findFirst({
      where: { farmId, name: 'Seed: Milking Herd Ration' },
    });
    if (!concentration) {
      concentration = await prisma.feedConcentration.create({
        data: {
          farmId,
          kind: 'FEED_MIXTURE',
          name: 'Seed: Milking Herd Ration',
          targetType: 'GROUP',
          createdBy,
        },
      });
    }

    // Mirrors `MilkService`'s own 7-day-submitted-average + `isAnomaly()` domain
    // rule — this loop writes `MilkLogEntry` rows directly via Prisma (not
    // through `saveLog()`), so without this the anomaly pipeline never runs on
    // seed data and `anomalyFlag` stays permanently false: the Anomalies panel
    // reads real empty and looks broken however low a seeded yield is.
    const yieldHistory = new Map<string, number[]>();
    for (let day = 1; day <= daysSoFar; day += 1) {
      const logDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day),
      );
      const dayWave = Math.sin((day / daysSoFar) * Math.PI * 2);

      for (const [idx, cow] of milkCows.entries()) {
        let yieldL = Math.round((28 + dayWave * 6 + idx) * 10) / 10;
        // Force one guaranteed, unmissable anomaly on the last seeded day so
        // QA/demo always has something to review in the Anomalies panel.
        if (day === daysSoFar && idx === 0) {
          yieldL = Math.round(yieldL * 0.4 * 10) / 10;
        }

        const history = yieldHistory.get(cow.id) ?? [];
        const avg7d =
          history.length > 0
            ? history.slice(-7).reduce((a, b) => a + b, 0) /
              Math.min(history.length, 7)
            : null;
        const anomalyFlag = isAnomaly(yieldL, avg7d);

        await prisma.milkLogEntry.upsert({
          where: {
            cattleId_logDate_session: {
              cattleId: cow.id,
              logDate,
              session: MilkSession.MORNING,
            },
          },
          update: {
            yieldL,
            disposition: MilkDisposition.SALEABLE,
            submitted: true,
            submittedAt: logDate,
            anomalyFlag,
          },
          create: {
            farmId,
            cattleId: cow.id,
            logDate,
            session: MilkSession.MORNING,
            yieldL,
            tankType: MilkTankType.SELLABLE,
            disposition: MilkDisposition.SALEABLE,
            submitted: true,
            submittedAt: logDate,
            anomalyFlag,
            createdBy,
          },
        });

        history.push(yieldL);
        yieldHistory.set(cow.id, history);
      }

      const actualKg = Math.round(80 + dayWave * 20);
      const pricePerKg = 12;
      const lineCost = actualKg * pricePerKg;
      const distReference = `SEED-FEED-${logDate.toISOString().slice(0, 10)}`;
      const existingDist = await prisma.feedDistribution.findFirst({
        where: {
          farmId,
          distributedAt: logDate,
          concentrationId: concentration.id,
        },
      });
      if (!existingDist) {
        await prisma.feedDistribution.create({
          data: {
            farmId,
            concentrationId: concentration.id,
            distributedAt: logDate,
            totalPlannedKg: actualKg,
            totalActualKg: actualKg,
            totalPlannedCost: lineCost,
            totalActualCost: lineCost,
            notes: distReference,
            createdBy,
            items: {
              create: [
                {
                  ingredientId: 'feed_napier',
                  ingredientName: 'Napier grass',
                  plannedKg: actualKg,
                  actualKg,
                  pricePerKg,
                  lineCost,
                },
              ],
            },
          },
        });
      }
    }
    console.log(
      `✔ demo production/feedcost history: ${daysSoFar} day(s) this month`,
    );
  }

  // ---- Conception Rate: 12 months of breeding events ----------------------
  const femaleCattle = await prisma.cattle.findMany({
    where: { farmId, gender: CattleGender.FEMALE },
    select: { id: true },
  });
  const bull = await prisma.cattle.findFirst({
    where: {
      farmId,
      gender: CattleGender.MALE,
    },
    select: { id: true },
  });
  if (femaleCattle.length > 0) {
    let breedingNumber = 1;
    for (let i = 11; i >= 0; i -= 1) {
      const breedingDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15),
      );
      const wave = (Math.sin(((11 - i) / 11) * Math.PI * 2) + 1) / 2; // 0..1
      const perMonth = 2 + Math.round(wave * 2); // 2..4 events/month
      for (let j = 0; j < perMonth; j += 1) {
        const cow = femaleCattle[(i * 3 + j) % femaleCattle.length];
        const confirmed = (i + j) % 2 === 0; // ~45-50% confirmed, matches Figma
        const existing = await prisma.breedingEvent.findFirst({
          where: { cattleId: cow.id, breedingDate, breedingNumber },
        });
        if (!existing) {
          await prisma.breedingEvent.create({
            data: {
              cattleId: cow.id,
              bullId: bull?.id ?? null,
              breedingDate,
              breedingMethod: BreedingMethod.AI,
              breedingNumber,
              status: confirmed
                ? BreedingStatus.PREGNANT
                : BreedingStatus.FAILED,
            },
          });
        }
        breedingNumber += 1;
      }
    }
    console.log('✔ demo conception-rate history: 12 months of breeding events');
  }
}

async function main(): Promise<void> {
  await seedPermissions();
  const ownerRoleId = await seedRole(SYSTEM_ROLES.OWNER);
  const managerRoleId = await seedRole(SYSTEM_ROLES.MANAGER);
  const workerRoleId = await seedRole(SYSTEM_ROLES.WORKER);
  // Units (RAKHAL-326) seeded early — `prisma/backfill-unit-catalog.ts` (run once,
  // after this seed + the additive migration) depends on the system rows existing.
  await seedUnits();
  // Income categories (RAKHAL-350) — same global catalogue seam as Units.
  await seedIncomeCategories();
  // Moved ahead of the demo block: the full demo dataset (seedDemoDataset)
  // references feed ingredients, repro protocols, subscription plans, and the
  // legal documents by id, so those catalogues must exist before it runs.
  await seedFeedIngredients();
  await seedReproProtocols();
  await seedSubscriptionPlans();
  await seedLegalConsent(null);
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
    await seedLedgerAccounts(demo.farmId);
    await seedDemoFinance(demo.farmId, demo.ownerUserId);
    // Full farm-facing dataset (prisma/demo-data/*.json) — runs before the
    // older 8-cow stub below so seedDemoCattle's idempotency guard
    // (`existing > 0`) skips once this real herd exists.
    await seedDemoDataset(prisma, {
      farmId: demo.farmId,
      ownerUserId: demo.ownerUserId,
      ownerRoleId,
      managerRoleId,
      workerRoleId,
    });
    await seedDemoCattle(demo.farmId, demo.ownerUserId);
    await seedDemoDashboardHistory(demo.farmId, demo.ownerUserId);
  }
  await seedInvoiceCounter();
  await seedPlatformAdmin();
  await seedLegalConsent(demo.ownerUserId ?? null);
  if (demo.farmId) {
    await seedDemoSubscription(demo.farmId);
  }
  await seedTestAccounts(prisma, ownerRoleId);
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
