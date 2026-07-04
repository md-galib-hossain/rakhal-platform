import { PlatformAdminRole } from '@prisma/client';

/**
 * Platform-admin JWT payload (RAKHAL-224). The `type` discriminator + the
 * separate signing secret (`JWT_ADMIN_SECRET`) together guarantee a farm access
 * token can never be mistaken for an admin token: a farm token is signed with a
 * different secret AND lacks `type: 'platform_admin'`.
 */
export interface AdminTokenPayload {
  sub: string; // PlatformAdmin.id
  role: PlatformAdminRole;
  type: 'platform_admin';
}
