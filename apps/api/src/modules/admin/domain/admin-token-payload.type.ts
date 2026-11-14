import { PlatformAdminRole } from '@prisma/client';

/**
 * Platform-admin JWT payload (RAKHAL-224). The `type` discriminator + the
 * separate signing secret (`JWT_ADMIN_SECRET`) together guarantee a farm access
 * token can never be mistaken for an admin token: a farm token is signed with a
 * different secret AND lacks `type: 'platform_admin'`.
 */
export interface AdminAccessTokenPayload {
  sub: string; // PlatformAdmin.id
  role: PlatformAdminRole;
  /** PlatformAdminSession.id — checked against the DB on every request (P2-01). */
  sid: string;
  type: 'platform_admin';
}

/**
 * Issued when a platform admin has authenticated with a password but has not
 * yet completed mandatory 2FA setup (RAKHAL-225). Scoped to the 2FA setup/enable
 * routes only — `PlatformAdminGuard` rejects this `type`.
 */
export interface AdminTwoFactorSetupTokenPayload {
  sub: string; // PlatformAdmin.id
  type: 'platform_admin_2fa_setup';
}

export type AdminTokenPayload =
  | AdminAccessTokenPayload
  | AdminTwoFactorSetupTokenPayload;
