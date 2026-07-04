import type { Request } from 'express';
import { PlatformAdminRole } from '@prisma/client';

/** The platform-admin identity attached to the request by `PlatformAdminGuard`. */
export interface CurrentAdminContext {
  id: string;
  email: string;
  role: PlatformAdminRole;
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: CurrentAdminContext;
}
