import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Loads the full demo dataset from `prisma/demo-data/*.json` (see the README
 * there for the token/consistency conventions). Idempotent — every row carries
 * a fixed `sd_*` id and is upserted, so re-running after `prisma migrate reset`
 * reproduces the same dataset. Called once from `prisma/seed.ts#main`, after
 * roles/feed-ingredients/repro-protocols/subscription-plans/legal-documents
 * exist (this dataset references all of them) and before the older
 * `seedDemoCattle`/`seedDemoDashboardHistory` stubs (which no-op once cattle
 * already exist / layer cleanly on top of a real herd).
 */

const DATA_DIR = path.join(__dirname, 'demo-data');

interface TokenContext {
  now: Date;
  farmId: string;
  farm2Id: string;
  userIds: Record<string, string>;
  roleIds: Record<string, string>;
  planIds: Record<string, string>;
  legalDocIds: Record<string, string>;
}

function resolveToken(s: string, ctx: TokenContext): unknown {
  if (s === '@farm') return ctx.farmId;
  if (s === '@farm2') return ctx.farm2Id;
  if (s === '@now') return ctx.now;
  if (s.startsWith('@user:')) {
    const id = ctx.userIds[s.slice(6)];
    if (!id) throw new Error(`seed-demo-data: unknown user token "${s}"`);
    return id;
  }
  if (s.startsWith('@role:')) {
    const id = ctx.roleIds[s.slice(6)];
    if (!id) throw new Error(`seed-demo-data: unknown role token "${s}"`);
    return id;
  }
  if (s.startsWith('@plan:')) {
    const id = ctx.planIds[s.slice(6)];
    if (!id) throw new Error(`seed-demo-data: unknown plan token "${s}"`);
    return id;
  }
  if (s.startsWith('@legal:')) {
    const id = ctx.legalDocIds[s.slice(7)];
    if (!id) throw new Error(`seed-demo-data: unknown legal doc token "${s}"`);
    return id;
  }
  let m = s.match(/^@daysAgo:(-?\d+(?:\.\d+)?)$/);
  if (m) return new Date(ctx.now.getTime() - parseFloat(m[1]) * 86_400_000);
  m = s.match(/^@daysFromNow:(-?\d+(?:\.\d+)?)$/);
  if (m) return new Date(ctx.now.getTime() + parseFloat(m[1]) * 86_400_000);
  m = s.match(/^@dayStart:(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const d = new Date(ctx.now.getTime() - parseFloat(m[1]) * 86_400_000);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }
  m = s.match(/^@monthsAgo:(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const d = new Date(ctx.now);
    d.setUTCMonth(d.getUTCMonth() - parseFloat(m[1]));
    return d;
  }
  return undefined;
}

function resolveValue(value: unknown, ctx: TokenContext): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('@')) {
      const resolved = resolveToken(value, ctx);
      if (resolved !== undefined) return resolved;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ctx));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, ctx);
    }
    return out;
  }
  return value;
}

function loadJson(file: string, ctx: TokenContext): Record<string, unknown>[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'),
  ) as unknown[];
  return resolveValue(raw, ctx) as Record<string, unknown>[];
}

// Prisma's generated delegate types are too specific to unify across ~50
// models in one generic helper; a seed loader trades that precision for a
// single upsert-by-id path shared by every table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = { upsert: (args: any) => Promise<unknown> };

async function up(
  delegate: AnyDelegate,
  row: Record<string, unknown>,
): Promise<void> {
  const { id, ...rest } = row;
  await delegate.upsert({ where: { id }, update: rest, create: row });
}

async function upAll(
  delegate: AnyDelegate,
  rows: Record<string, unknown>[],
): Promise<number> {
  for (const row of rows) await up(delegate, row);
  return rows.length;
}

/**
 * For tables with a natural unique key besides `id` that other agents'
 * e2e/dev runs may have already populated for the demo farm/users (e.g.
 * `FarmModuleSettings.farmId`) — upserting by `id` would try to *create* a
 * second row and hit that unique constraint. Target the natural key instead.
 */
async function upAllByKey(
  delegate: AnyDelegate,
  rows: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<number> {
  for (const row of rows) {
    const { id, ...rest } = row;
    await delegate.upsert({ where: keyOf(row), update: rest, create: row });
  }
  return rows.length;
}

export async function seedDemoDataset(
  prisma: PrismaClient,
  params: {
    farmId: string;
    ownerUserId: string;
    ownerRoleId: string;
    managerRoleId: string;
    workerRoleId: string;
  },
): Promise<void> {
  const manager = await prisma.user.findUniqueOrThrow({
    where: { email: 'manager@demo.rakhal.test' },
    select: { id: true },
  });
  const worker = await prisma.user.findUniqueOrThrow({
    where: { email: 'worker@demo.rakhal.test' },
    select: { id: true },
  });

  const worker2Hash = await argon2.hash('WorkerPass123', {
    type: argon2.argon2id,
  });
  const worker2 = await prisma.user.upsert({
    where: { email: 'worker2@demo.rakhal.test' },
    update: {},
    create: {
      email: 'worker2@demo.rakhal.test',
      name: 'Demo Worker 2',
      passwordHash: worker2Hash,
      isEmailVerified: true,
    },
    select: { id: true },
  });
  await prisma.farmMember.upsert({
    where: {
      farmId_userId: { farmId: params.farmId, userId: worker2.id },
    },
    update: { roleId: params.workerRoleId },
    create: {
      farmId: params.farmId,
      userId: worker2.id,
      roleId: params.workerRoleId,
    },
  });

  const neighborHash = await argon2.hash('NeighborPass123', {
    type: argon2.argon2id,
  });
  const neighbor = await prisma.user.upsert({
    where: { email: 'neighbor@demo.rakhal.test' },
    update: {},
    create: {
      email: 'neighbor@demo.rakhal.test',
      name: 'Rina (Green Valley Dairy)',
      passwordHash: neighborHash,
      isEmailVerified: true,
    },
    select: { id: true },
  });

  const plans = await prisma.subscriptionPlan.findMany({
    select: { id: true, name: true },
  });
  const planIds = Object.fromEntries(plans.map((p) => [p.name, p.id]));

  const legalDocs = await prisma.legalDocument.findMany({
    where: { version: '1.0' },
    select: { id: true, type: true },
  });
  const legalDocIds = Object.fromEntries(legalDocs.map((d) => [d.type, d.id]));

  const ctx: TokenContext = {
    now: new Date(),
    farmId: params.farmId,
    farm2Id: 'sd_farm2',
    userIds: {
      owner: params.ownerUserId,
      manager: manager.id,
      worker: worker.id,
      worker2: worker2.id,
      neighbor: neighbor.id,
    },
    roleIds: {
      owner: params.ownerRoleId,
      manager: params.managerRoleId,
      worker: params.workerRoleId,
    },
    planIds,
    legalDocIds,
  };

  // ---- Phase A — reference data + farm2 ----------------------------------
  await upAll(prisma.breed, loadJson('breeds.json', ctx));
  await upAll(prisma.shed, loadJson('sheds.json', ctx));
  await upAll(prisma.farm, loadJson('farms.json', ctx));

  for (const row of loadJson('farm-members-extra.json', ctx)) {
    const { farmId, userId, roleId } = row as {
      farmId: string;
      userId: string;
      roleId: string;
    };
    await prisma.farmMember.upsert({
      where: { farmId_userId: { farmId, userId } },
      update: { roleId },
      create: { farmId, userId, roleId },
    });
  }

  // ---- Phase B — herd -----------------------------------------------------
  await upAll(prisma.cattle, loadJson('cattle.json', ctx));
  await upAll(prisma.weightRecord, loadJson('weight-records.json', ctx));
  await upAll(prisma.bodyConditionScore, loadJson('bcs-records.json', ctx));
  await upAll(
    prisma.reproductionProfile,
    loadJson('reproduction-profiles.json', ctx),
  );
  await upAll(prisma.semenTank, loadJson('semen-tanks.json', ctx));
  await upAll(prisma.semenBatch, loadJson('semen-batches.json', ctx));
  await upAll(prisma.heatEvent, loadJson('heat-events.json', ctx));
  await upAll(prisma.breedingEvent, loadJson('breeding-events.json', ctx));
  await upAll(
    prisma.pregnancyDiagnosis,
    loadJson('pregnancy-diagnoses.json', ctx),
  );
  await upAll(prisma.pregnancy, loadJson('pregnancies.json', ctx));
  await upAll(prisma.calvingEvent, loadJson('calving-events.json', ctx));
  await upAll(prisma.calfBirth, loadJson('calf-births.json', ctx));
  await upAll(prisma.abortionEvent, loadJson('abortion-events.json', ctx));
  await upAll(prisma.dryPeriod, loadJson('dry-periods.json', ctx));
  await upAll(prisma.lactation, loadJson('lactations.json', ctx));
  await upAll(
    prisma.reproProtocolInstance,
    loadJson('repro-protocol-instances.json', ctx),
  );
  await upAll(
    prisma.calfColostrumRecord,
    loadJson('calf-colostrum-records.json', ctx),
  );
  await upAll(prisma.calfMilkFeeding, loadJson('calf-milk-feedings.json', ctx));
  await upAll(
    prisma.calfWeightRecord,
    loadJson('calf-weight-records.json', ctx),
  );
  await upAll(
    prisma.calfStarterFeedRecord,
    loadJson('calf-starter-feed-records.json', ctx),
  );
  await upAll(
    prisma.calfWeaningRecord,
    loadJson('calf-weaning-records.json', ctx),
  );

  // ---- Phase C — health -----------------------------------------------------
  await upAll(prisma.diseaseCatalog, loadJson('disease-catalog.json', ctx));
  await upAll(prisma.healthPlan, loadJson('health-plans.json', ctx));
  await upAll(prisma.healthPlanStep, loadJson('health-plan-steps.json', ctx));
  await upAll(prisma.healthCase, loadJson('health-cases.json', ctx));
  // RAKHAL-415/RD-093: a preventive `PlanApplication` round's `HealthTask`s carry
  // `planEnrollmentId` instead of `healthCaseId` — seeded so the caseless log-treatment path
  // (`POST /health/tasks/:id/log-treatment`) has a demo row to exercise, not just the
  // case-backed one.
  await upAll(prisma.planApplication, loadJson('plan-applications.json', ctx));
  await upAll(prisma.planEnrollment, loadJson('plan-enrollments.json', ctx));
  await upAll(prisma.healthTask, loadJson('health-tasks.json', ctx));
  await upAll(prisma.treatmentLog, loadJson('treatment-logs.json', ctx));
  await upAll(prisma.healthUpdate, loadJson('health-updates.json', ctx));
  await upAll(prisma.mortalityRecord, loadJson('mortality-records.json', ctx));
  await upAll(
    prisma.safetyWithdrawal,
    loadJson('safety-withdrawals.json', ctx),
  );

  // ---- Phase D — inventory --------------------------------------------------
  await upAll(prisma.medicine, loadJson('medicines.json', ctx));
  await upAll(
    prisma.medicineStockMovement,
    loadJson('medicine-stock-movements.json', ctx),
  );
  await upAll(
    prisma.nutritionProfile,
    loadJson('nutrition-profiles.json', ctx),
  );
  await upAll(prisma.feedItem, loadJson('forages.json', ctx));
  await upAll(prisma.feedItemBatch, loadJson('feed-item-batches.json', ctx));
  await upAll(prisma.milkTank, loadJson('milk-tanks.json', ctx));
  await upAll(
    prisma.milkTankAuditLog,
    loadJson('milk-tank-audit-logs.json', ctx),
  );
  await upAll(prisma.equipment, loadJson('equipment.json', ctx));

  // ---- Phase E — milk & buyers -----------------------------------------------
  // Delete-then-recreate, not `upAll`/`upAllByKey` — every row's `logDate` is
  // `@dayStart:N`, relative to `now` at seed time, so both this fixture's
  // fixed `id`s AND its `(cattleId, logDate, session)` natural keys drift onto
  // different calendar dates on every later run. A stale row from an earlier
  // run's date can collide with either key depending on which one a later run
  // happens to hit first (id-based `upAll` hit the natural-key collision;
  // switching to natural-key `upAllByKey` just hit the mirror-image id
  // collision on the *other* stale row on some other date). Wiping every log
  // entry for exactly this fixture's cattle first — not just its own fixed
  // ids — clears both the id-collision and the natural-key-collision culprits
  // in one pass, since this dataset is the sole owner of these `sd_cattle_*`
  // demo cows' milk history.
  const milkLogRows = loadJson('milk-log-entries.json', ctx);
  const milkLogCattleIds = [
    ...new Set(milkLogRows.map((r) => r.cattleId as string)),
  ];
  await prisma.milkLogEntry.deleteMany({
    where: { farmId: ctx.farmId, cattleId: { in: milkLogCattleIds } },
  });
  await prisma.milkLogEntry.createMany({ data: milkLogRows as never[] });
  await upAll(prisma.milkBuyer, loadJson('milk-buyers.json', ctx));
  await upAll(prisma.milkDispatch, loadJson('milk-dispatches.json', ctx));

  // ---- Phase F — finance -------------------------------------------------
  // RAKHAL-354: `finance-transactions.json`/`finance-receivables.json`/
  // `wallet-transactions.json` deleted along with `FinanceTransaction`/
  // `FinanceReceivable`/`WalletTransaction` (V1, dropped this ticket) — no
  // row-for-row V2 fixture replaces them; `prisma/seed.ts`'s own
  // `seedDemoFinance`/`seedDemoDashboardHistory` post a smaller hand-written
  // set of real V2 `FinancialAccount`/`JournalTransaction`/`Sale`/
  // `Receivable` rows instead (not JSON-fixture-driven, see those functions'
  // own doc comments). `FinanceLoan`/`FixedAsset` survive unchanged —
  // `FINANCE_V2_DESIGN.md` §5.2, no V2 replacement exists for either.
  await upAll(prisma.financeLoan, loadJson('finance-loans.json', ctx));
  await upAll(prisma.fixedAsset, loadJson('fixed-assets.json', ctx));

  // ---- Phase G — settings/tasks -------------------------------------------
  await upAll(prisma.supplier, loadJson('suppliers.json', ctx));
  await upAllByKey(
    prisma.farmModuleSettings,
    loadJson('farm-module-settings.json', ctx),
    (r) => ({ farmId: r.farmId }),
  );
  await upAll(prisma.task, loadJson('tasks.json', ctx));

  // ---- Phase H — feed formulator -------------------------------------------
  await upAllByKey(
    prisma.feedIngredientOverride,
    loadJson('feed-ingredient-overrides.json', ctx),
    (r) => ({
      farmId_ingredientId: { farmId: r.farmId, ingredientId: r.ingredientId },
    }),
  );
  await upAll(
    prisma.feedConcentration,
    loadJson('feed-concentrations.json', ctx),
  );
  await upAll(
    prisma.feedConcentrationItem,
    loadJson('feed-concentration-items.json', ctx),
  );
  await upAll(
    prisma.feedDistribution,
    loadJson('feed-distributions.json', ctx),
  );
  await upAll(
    prisma.feedDistributionItem,
    loadJson('feed-distribution-items.json', ctx),
  );

  // ---- Phase I — notifications/scoreboard/support ---------------------------
  await upAll(prisma.notification, loadJson('notifications.json', ctx));
  await upAllByKey(
    prisma.notificationPreference,
    loadJson('notification-preferences.json', ctx),
    (r) => ({ userId_eventKey: { userId: r.userId, eventKey: r.eventKey } }),
  );
  await upAllByKey(
    prisma.notificationSetting,
    loadJson('notification-settings.json', ctx),
    (r) => ({ userId: r.userId }),
  );
  await upAllByKey(
    prisma.scoreboardParticipation,
    loadJson('scoreboard-participation.json', ctx),
    (r) => ({ farmId: r.farmId }),
  );
  await upAll(prisma.supportFeedback, loadJson('support-feedback.json', ctx));

  // ---- Phase J — monetization (farm2 referral/coupon story) -----------------
  await upAll(prisma.coupon, loadJson('coupons.json', ctx));
  await upAll(prisma.referralCode, loadJson('referral-codes.json', ctx));
  await upAll(prisma.referral, loadJson('referrals.json', ctx));
  await upAllByKey(
    prisma.creditWallet,
    loadJson('credit-wallets.json', ctx),
    (r) => ({ farmId: r.farmId }),
  );
  await upAll(
    prisma.farmSubscription,
    loadJson('farm-subscriptions-extra.json', ctx),
  );
  await upAll(prisma.invoice, loadJson('invoices.json', ctx));
  await upAll(prisma.payment, loadJson('payments.json', ctx));
  await upAll(
    prisma.couponRedemption,
    loadJson('coupon-redemptions.json', ctx),
  );
  await upAll(
    prisma.referralCommission,
    loadJson('referral-commissions.json', ctx),
  );
  await upAll(
    prisma.consentRecord,
    loadJson('consent-records-extra.json', ctx),
  );

  console.log(
    '✔ demo dataset: full sample data loaded (2 farms, 20 cattle, health/repro/milk/finance/feed/notifications/billing)',
  );
}
