import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSION_KEY = 'admin_permission';

/** Route-level guard for `AdminPermissionGuard` — e.g. `@RequireAdminPermission('coupon.manage')`. */
export const RequireAdminPermission = (permission: string) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permission);

export const ADMIN_AUTHENTICATED_ONLY_KEY = 'admin_authenticated_only';

/**
 * Explicit opt-out from the permission matrix for routes that every
 * authenticated, active admin may call (RAKHAL-P2-02: `AdminPermissionGuard` is
 * default-deny, so a route without `@RequireAdminPermission` or this marker is
 * rejected). Use sparingly — prefer a real permission key.
 */
export const AdminAuthenticatedOnly = () =>
  SetMetadata(ADMIN_AUTHENTICATED_ONLY_KEY, true);
