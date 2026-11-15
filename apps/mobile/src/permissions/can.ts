/**
 * Permission check (WP6). Pure; mirrors `PermissionService.matchesPermission` in `apps/api` and `useCan` on the web:
 * a permission is `resource.action`; the account may hold `*` (everything, the Owner role), `resource.*` (every action
 * on a resource, the Manager role) or the exact string. Components never compare role names: they ask `can(...)`.
 * The server still enforces every request; this only decides what the UI offers.
 */
export type Permission = string;

export function can(granted: readonly Permission[] | null | undefined, required: Permission | null | undefined): boolean {
  if (required === null || required === undefined) return true;
  if (!granted) return false;
  if (granted.includes('*') || granted.includes(required)) return true;
  const resource = required.split('.')[0];
  return resource ? granted.includes(`${resource}.*`) : false;
}

/** True when the account holds at least one of the permissions (an empty list means "no requirement"). */
export function canAny(granted: readonly Permission[] | null | undefined, required: readonly Permission[]): boolean {
  if (required.length === 0) return true;
  return required.some((permission) => can(granted, permission));
}
