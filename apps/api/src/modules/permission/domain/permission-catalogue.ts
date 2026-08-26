import { PermissionGroup } from '@prisma/client';

/**
 * The canonical RBAC catalogue — single source of truth for the permission
 * seed (`prisma/seed.ts`) and any future role-editor UI.
 *
 * Permission keys follow `resource.action`. The guard matcher (PermissionService)
 * supports exact (`inventory.read`), resource-wildcard (`inventory.*`), and
 * global (`*`) grants, so role grants below mix wildcards and specific keys to
 * model the PRD §26 matrix (owner-only actions are granted explicitly, never via
 * a broad wildcard).
 */

/** Fixed system role names (created globally, `farmId = null`, `isSystemRole`). */
export const SYSTEM_ROLES = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WORKER: 'Worker',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export interface PermissionDef {
  key: string;
  group: PermissionGroup;
  description: string;
}

interface ResourceDef {
  resource: string;
  group: PermissionGroup;
  actions: string[];
}

const BASE = ['read', 'create', 'update', 'delete'];

const RESOURCES: ResourceDef[] = [
  {
    resource: 'dashboard',
    group: PermissionGroup.DASHBOARD,
    actions: ['read'],
  },
  {
    resource: 'cattle',
    group: PermissionGroup.CATTLE,
    // RAKHAL-399: `dispose` is its own explicit permission (not folded into
    // `archive`) — disposing an animal (Sold/Culled/Deceased) is a distinct,
    // higher-stakes action from a plain soft-delete archive. RAKHAL-400:
    // `hold` closes a pre-existing gap — `AnimalHoldController`'s 3 routes
    // have required `cattle.hold` since RAKHAL-280, but it was never added
    // here, so no role had a real catalogue entry for it (PermissionGuard's
    // wildcard match still let Owner/Manager through in practice — this was
    // a missing-catalogue-row gap, not a live-broken route).
    actions: [...BASE, 'bcs', 'archive', 'bulk', 'dispose', 'hold'],
  },
  {
    resource: 'reproduction',
    group: PermissionGroup.REPRODUCTION,
    actions: [...BASE, 'heat'],
  },
  {
    resource: 'milk',
    group: PermissionGroup.MILK,
    // 'quality.create'/'quality.read' (RAKHAL-282) back MilkQualityTest
    // (lab/device fat/protein/SCC/MUN readings), distinct from the daily-yield
    // `log`/`withholding-override` actions above.
    actions: [
      ...BASE,
      'log',
      'withholding-override',
      'quality.create',
      'quality.read',
    ],
  },
  {
    resource: 'feed',
    group: PermissionGroup.FEED,
    actions: [...BASE, 'distribution-log'],
  },
  {
    resource: 'healthcare',
    group: PermissionGroup.HEALTHCARE,
    actions: [...BASE, 'report-sickness', 'log-treatment', 'close-case'],
  },
  {
    resource: 'calf',
    group: PermissionGroup.CALF,
    actions: [...BASE, 'log-feeding'],
  },
  { resource: 'inventory', group: PermissionGroup.INVENTORY, actions: BASE },
  {
    resource: 'finance',
    group: PermissionGroup.FINANCE,
    // 'accounts' (RAKHAL-335, Finance V2) backs Financial Accounts (Cash/Bank/
    // MFS) — Owner+Manager per the existing finance grant pattern, not Worker.
    // 'transfer' (RAKHAL-338, Finance V2) backs account-to-account Transfers.
    // RAKHAL-338's own AC shipped this as Owner+Manager; RAKHAL-353
    // (governance pass, `FINANCE_V2_DESIGN.md` §4.2/§6) tightens it to
    // **owner-only**, same tier as 'void' below — moving real money between
    // accounts (and the fee it can post) is judged sensitive enough to match
    // void, not the read/write tier of 'accounts'. See ROLE_PERMISSIONS: this
    // key is deliberately absent from Manager's grant.
    // 'reverse' (RAKHAL-353, `JournalService.reverseJournal`, RAKHAL-334) backs
    // reversing an immutable posted journal transaction — owner-only, same
    // reasoning as 'transfer'/'void'. No controller currently exposes
    // `reverseJournal` over HTTP (it is invoked internally, e.g. by voided
    // payments/sales use cases); the permission is added now so the seam is
    // gated the moment a route calls it, per this ticket's own governance
    // scope — nothing to wire today.
    actions: [...BASE, 'void', 'billing', 'accounts', 'transfer', 'reverse'],
  },
  {
    // Sales (RAKHAL-339, Sales module — `FINANCE_V2_DESIGN.md` §4.3, §5.1). Reuses
    // the existing FINANCE permission group (no new `PermissionGroup` enum value
    // added — sales documents are financial/commercial data, same sensitivity
    // class as `finance`, and `PermissionGroup` is schema-backed so adding a value
    // would need its own migration for what is otherwise a UI-grouping label).
    // 'update'/'delete' added by RAKHAL-353 for completeness of the catalogue —
    // `SaleController` still exposes only create+read (no route calls them yet,
    // same as 'finance.reverse' above); Manager already holds 'sales.*' so these
    // are gated automatically the moment an edit/cancel route is built.
    resource: 'sales',
    group: PermissionGroup.FINANCE,
    actions: ['read', 'create', 'update', 'delete'],
  },
  // Purchasing (RAKHAL-348) — same reasoning as `sales` immediately above:
  // reuses `PermissionGroup.FINANCE` (a purchase/expense/payable document is
  // the same sensitivity tier as `finance`/`sales`, and `PermissionGroup` is
  // schema-backed so a new value would need its own migration for what is
  // otherwise a UI-grouping label). Only `read`/`create` — no update/delete
  // route exists yet either, mirroring `sales`'s own scoping.
  {
    resource: 'purchasing',
    group: PermissionGroup.FINANCE,
    actions: ['read', 'create'],
  },
  {
    resource: 'task',
    group: PermissionGroup.TASK,
    actions: [...BASE, 'complete', 'assign'],
  },
  {
    resource: 'reports',
    group: PermissionGroup.REPORTS,
    actions: ['read', 'create', 'schedule'],
  },
  {
    resource: 'scoreboard',
    group: PermissionGroup.SCOREBOARD,
    actions: ['read', 'join'],
  },
  { resource: 'activity', group: PermissionGroup.ACTIVITY, actions: ['read'] },
  {
    resource: 'settings',
    group: PermissionGroup.SETTINGS,
    actions: [
      'read',
      'update',
      'team-manage',
      'roles-manage',
      'billing',
      'milk-sessions-manage',
    ],
  },
  {
    resource: 'notification',
    group: PermissionGroup.NOTIFICATION,
    actions: ['read', 'update'],
  },
  {
    resource: 'team',
    group: PermissionGroup.TEAM,
    actions: ['read', 'invite', 'remove'],
  },
  // Subscription / billing self-serve (RAKHAL-219). `read` = view status (all
  // roles); `manage` = purchase/upgrade/cancel/redeem (Owner-only via `*`).
  {
    resource: 'subscription',
    group: PermissionGroup.SETTINGS,
    actions: ['read', 'manage'],
  },
  // Referrals self-serve (RAKHAL-223) — code/link/credit is growth-financial
  // data, so Owner+Manager only (like finance), not Worker.
  {
    resource: 'referral',
    group: PermissionGroup.SETTINGS,
    actions: ['read'],
  },
  // Media / image uploads (RAKHAL-009). `read` = fetch a presigned URL (all
  // roles, farm-scoped); `upload`/`delete` = generic media management. Attaching
  // an image to an entity is additionally governed by that entity's own
  // permission (e.g. a cattle profile photo requires `cattle.update`).
  {
    resource: 'media',
    group: PermissionGroup.GENERAL,
    actions: ['read', 'upload', 'delete'],
  },
];

/** The full permission catalogue: every `resource.action`, a `resource.*` per resource, and global `*`. */
export const PERMISSIONS: PermissionDef[] = [
  { key: '*', group: PermissionGroup.GENERAL, description: 'Full access' },
  ...RESOURCES.flatMap((r) => [
    {
      key: `${r.resource}.*`,
      group: r.group,
      description: `All ${r.resource} actions`,
    },
    ...r.actions.map((action) => ({
      key: `${r.resource}.${action}`,
      group: r.group,
      description: `${action} ${r.resource}`,
    })),
  ]),
];

/**
 * Permission keys granted to each system role (PRD §26).
 * Owner = everything; Manager = broad operations minus owner-only actions;
 * Worker = the narrow field-task set.
 */
export const ROLE_PERMISSIONS: Record<SystemRoleName, string[]> = {
  [SYSTEM_ROLES.OWNER]: ['*'],
  [SYSTEM_ROLES.MANAGER]: [
    'dashboard.*',
    'cattle.*',
    'reproduction.*',
    'feed.*',
    'healthcare.*',
    'calf.*',
    'inventory.*',
    'task.*',
    'reports.*',
    'activity.*',
    'notification.*',
    // Milk minus owner-only withholding-override
    'milk.read',
    'milk.create',
    'milk.update',
    'milk.delete',
    'milk.log',
    'milk.quality.create',
    'milk.quality.read',
    // Finance minus owner-only void/billing/transfer/reverse
    'finance.read',
    'finance.create',
    'finance.update',
    // Financial Accounts (RAKHAL-335) — Owner+Manager, not Worker
    'finance.accounts',
    // Transfers (RAKHAL-338) were originally Owner+Manager; RAKHAL-353
    // (governance pass) moves 'finance.transfer' to owner-only, alongside the
    // new 'finance.reverse' — both intentionally excluded from this list, same
    // as 'finance.void'/'finance.billing' above.
    // Sales (RAKHAL-339) — Owner+Manager, not Worker (same tier as finance —
    // a sale document is financial/commercial data, not a field task).
    'sales.*',
    // Purchasing (RAKHAL-348) — Owner+Manager, not Worker, same tier as `sales`.
    'purchasing.*',
    // Settings minus owner-only team/roles/billing management
    'settings.read',
    'settings.update',
    'team.read',
    // Scoreboard view only (join is owner-only)
    'scoreboard.read',
    // View subscription status (purchase/manage is owner-only)
    'subscription.read',
    'referral.read',
    // Media management (upload/delete/read), farm-scoped
    'media.*',
  ],
  [SYSTEM_ROLES.WORKER]: [
    'dashboard.read',
    'cattle.read',
    'cattle.bcs',
    'reproduction.heat',
    'milk.read',
    'milk.create',
    'milk.log',
    'milk.quality.read',
    'healthcare.read',
    'healthcare.report-sickness',
    'healthcare.log-treatment',
    'calf.read',
    'calf.log-feeding',
    'feed.distribution-log',
    'inventory.read',
    'task.read',
    'task.complete',
    'notification.read',
    'subscription.read',
    // Workers capture photos in the field + view them
    'media.read',
    'media.upload',
  ],
};
