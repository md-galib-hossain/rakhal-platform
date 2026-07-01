/**
 * Subscription plan + feature catalogue (PRD §31.1, RAKHAL-217).
 *
 * Single source of truth shared by:
 *  - `prisma/seed.ts` → seeds `Feature`, `SubscriptionPlan`, `SubscriptionFeature`.
 *  - the entitlement layer (`SubscriptionAccessService` + `@RequireFeature('<key>')`).
 *
 * A **feature key** is the stable identifier a gated route declares via
 * `@RequireFeature('reports.generate')` (RAKHAL-219) — never a plan name.
 *
 * Prices are **provisional** ৳ (BDT) launch values, admin-tunable later
 * (RAKHAL-253 / PRD §35.33). Limits: `null` = unlimited (fair-use).
 */

export const FEATURES = {
  // Free (core) tier
  CATTLE: 'cattle.module',
  MILK: 'milk.module',
  TASKS: 'tasks.module',
  DASHBOARD_BASIC: 'dashboard.basic',
  // Starter tier adds
  REPRODUCTION: 'reproduction.module',
  HEALTHCARE: 'healthcare.module',
  INVENTORY: 'inventory.module',
  FINANCE: 'finance.module',
  FEED_FORMULATOR: 'feed.formulator',
  BUYERS_DISPATCH: 'buyers.dispatch',
  SMS_NOTIFICATIONS: 'sms.notifications',
  // Pro tier adds
  REPORTS_GENERATE: 'reports.generate',
  SCOREBOARD: 'scoreboard.read',
  DASHBOARD_ADVANCED: 'dashboard.advanced',
  REPORTS_SCHEDULED: 'reports.scheduled',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export interface FeatureDef {
  key: FeatureKey;
  description: string;
}

/** Every feature key with a human description (seeded into `Feature`). */
export const FEATURE_CATALOGUE: FeatureDef[] = [
  { key: FEATURES.CATTLE, description: 'Cattle management' },
  { key: FEATURES.MILK, description: 'Milk logging' },
  { key: FEATURES.TASKS, description: 'Task hub' },
  { key: FEATURES.DASHBOARD_BASIC, description: 'Basic dashboard' },
  { key: FEATURES.REPRODUCTION, description: 'Reproduction module' },
  { key: FEATURES.HEALTHCARE, description: 'Healthcare module' },
  { key: FEATURES.INVENTORY, description: 'Inventory module' },
  { key: FEATURES.FINANCE, description: 'Finance module' },
  { key: FEATURES.FEED_FORMULATOR, description: 'Feed formulator' },
  { key: FEATURES.BUYERS_DISPATCH, description: 'Milk buyers & dispatch' },
  { key: FEATURES.SMS_NOTIFICATIONS, description: 'SMS notifications' },
  { key: FEATURES.REPORTS_GENERATE, description: 'Reports engine' },
  { key: FEATURES.SCOREBOARD, description: 'Scoreboard / leaderboard' },
  { key: FEATURES.DASHBOARD_ADVANCED, description: 'Advanced analytics' },
  { key: FEATURES.REPORTS_SCHEDULED, description: 'Scheduled reports' },
];

export interface PlanDef {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  maxCattle: number | null;
  maxFarmMembers: number | null;
  features: FeatureKey[];
}

const FREE_FEATURES: FeatureKey[] = [
  FEATURES.CATTLE,
  FEATURES.MILK,
  FEATURES.TASKS,
  FEATURES.DASHBOARD_BASIC,
];

const STARTER_FEATURES: FeatureKey[] = [
  ...FREE_FEATURES,
  FEATURES.REPRODUCTION,
  FEATURES.HEALTHCARE,
  FEATURES.INVENTORY,
  FEATURES.FINANCE,
  FEATURES.FEED_FORMULATOR,
  FEATURES.BUYERS_DISPATCH,
  FEATURES.SMS_NOTIFICATIONS,
];

const PRO_FEATURES: FeatureKey[] = [
  ...STARTER_FEATURES,
  FEATURES.REPORTS_GENERATE,
  FEATURES.SCOREBOARD,
  FEATURES.DASHBOARD_ADVANCED,
  FEATURES.REPORTS_SCHEDULED,
];

/** The three launch plans (PRD §31.1). Yearly ≈ 2 months free. */
export const PLAN_CATALOGUE: PlanDef[] = [
  {
    name: 'Free',
    description:
      'Trial / evaluation — core herd + milk + tasks for up to 20 cattle.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxCattle: 20,
    maxFarmMembers: 2,
    features: FREE_FEATURES,
  },
  {
    name: 'Starter',
    description:
      'Working farms (20–100 animals): all core modules + finance, feed, SMS.',
    monthlyPrice: 1000,
    yearlyPrice: 10000,
    maxCattle: 100,
    maxFarmMembers: 5,
    features: STARTER_FEATURES,
  },
  {
    name: 'Pro',
    description:
      'Larger farms (100–500 animals): everything + reports, scoreboard, advanced analytics.',
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    maxCattle: null,
    maxFarmMembers: null,
    features: PRO_FEATURES,
  },
];

/** Canonical plan names (must match the seeded `SubscriptionPlan.name`). */
export const PLAN_NAMES = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
} as const;

/** Lifecycle constants (RAKHAL-218, PRD §31.2). */
export const TRIAL_PLAN_NAME: string = PLAN_NAMES.STARTER; // new farms trial Starter
export const TRIAL_DURATION_DAYS = 14; // SUB-01
export const GRACE_PERIOD_DAYS = 3; // PAST_DUE window before hard expiry (SUB-03)
