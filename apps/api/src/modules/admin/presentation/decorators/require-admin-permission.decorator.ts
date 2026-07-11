import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSION_KEY = 'admin_permission';

/** Route-level guard for `AdminPermissionGuard` — e.g. `@RequireAdminPermission('coupon.manage')`. */
export const RequireAdminPermission = (permission: string) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permission);
