import { PlatformAdminRole } from '@prisma/client';
export declare function adminRoleGrants(role: PlatformAdminRole): string[];
export declare function adminRoleHasPermission(role: PlatformAdminRole, required: string): boolean;
