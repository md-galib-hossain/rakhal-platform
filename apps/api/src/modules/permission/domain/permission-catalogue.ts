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
    actions: [...BASE, 'bcs', 'archive', 'bulk'],
  },
  {
    resource: 'reproduction',
    group: PermissionGroup.REPRODUCTION,
    actions: [...BASE, 'heat'],
  },
  {
    resource: 'milk',
    group: PermissionGroup.MILK,
    actions: [...BASE, 'log', 'withholding-override'],
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
    actions: [...BASE, 'void', 'billing'],
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
    actions: ['read', 'update', 'team-manage', 'roles-manage', 'billing'],
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
    // Finance minus owner-only void/billing
    'finance.read',
    'finance.create',
    'finance.update',
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
