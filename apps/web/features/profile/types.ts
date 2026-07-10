/** Mirrors the backend's raw `User` scalars (`findSafeUserById` omits only `passwordHash`) plus
 * `permissions` (RAKHAL-260). Verified live against `auth.service.ts#me`/`auth.repository.ts`
 * (RFE-007) — the backend has no `fullName`/`phone`/`role`/`avatarUrl`/organization fields on
 * this response; `docs/Rakhal_API.md`'s richer shape is aspirational (see PROJECT_PROGRESS.md gaps). */
export interface ProfileUser {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  isBlocked: boolean;
  permissionsVersion: number;
  preferredLanguage: "BN" | "EN";
  lastLoginAt: string | null;
  lastPasswordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

/** Raw `Session` row (`GET /auth/sessions` returns the model as-is, no `select`/`isCurrent` flag —
 * "current device" is derived client-side by matching `id` against the session's own JWT claim). */
export interface SessionItem {
  id: string;
  userId: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "COMPROMISED";
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevokeSessionResult {
  success: true;
  revokedRefreshTokens?: number;
}

export interface LogoutAllResult {
  success: true;
  revokedSessions?: number;
  revokedRefreshTokens?: number;
}
