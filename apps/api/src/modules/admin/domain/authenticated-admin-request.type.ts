import type { Request } from 'express';
import { PlatformAdminRole } from '@prisma/client';

/** The platform-admin identity attached to the request by `PlatformAdminGuard`. */
export interface CurrentAdminContext {
  id: string;
  email: string;
  role: PlatformAdminRole;
  /** Present on full sessions; absent on 2FA-setup-scoped requests. */
  sessionId?: string;
  /** P2-05: a temporary password is in force; only change-password/logout work. */
  mustChangePassword?: boolean;
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: CurrentAdminContext;
}
