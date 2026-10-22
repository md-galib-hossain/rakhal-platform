import { PlatformAdminRole } from '@prisma/client';

/**
 * Static platform-admin RBAC matrix (RAKHAL-225, PRD §35.21). Unlike the farm
 * `PermissionService` (DB-backed, per-farm-customisable roles), admin roles are
 * a fixed, code-defined set — there is no per-admin role editor at launch.
 * `SUPER_ADMIN` is a wildcard; every other role is an explicit allow-list of
 * `resource.action` keys (`resource.*` wildcards allowed).
 */
const ADMIN_ROLE_GRANTS: Record<PlatformAdminRole, string[]> = {
  SUPER_ADMIN: ['*'],
  SUPPORT_ADMIN: [
    'feedback.*',
    'user.*',
    'farm.read',
    'audit.read',
    'coupon.read',
    'referral.read',
    'plan.read',
    'system.read',
    'config.read',
  ],
  BILLING_ADMIN: [
    'coupon.*',
    'referral.*',
    'reconciliation.*',
    'farm.read',
    'plan.read',
    'audit.read',
  ],
  CONTENT_ADMIN: ['audit.read', 'feed-ingredient.*', 'requirement-preset.*'],
};

function matches(grant: string, required: string): boolean {
  if (grant === '*') return true;
  if (grant === required) return true;
  if (grant.endsWith('.*')) {
    return required.startsWith(grant.slice(0, -1));
  }
  return false;
}

/** The role's grants as declared (may contain `*` and `resource.*` wildcards) — for clients that gate UI. */
export function adminRoleGrants(role: PlatformAdminRole): string[] {
  return [...(ADMIN_ROLE_GRANTS[role] ?? [])];
}

export function adminRoleHasPermission(
  role: PlatformAdminRole,
  required: string,
): boolean {
  const grants = ADMIN_ROLE_GRANTS[role] ?? [];
  return grants.some((grant) => matches(grant, required));
}
