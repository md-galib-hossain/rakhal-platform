import type { Request } from 'express';
import { PlatformAdminRole } from '@prisma/client';
export interface CurrentAdminContext {
    id: string;
    email: string;
    role: PlatformAdminRole;
    sessionId?: string;
    mustChangePassword?: boolean;
}
export interface AuthenticatedAdminRequest extends Request {
    admin?: CurrentAdminContext;
}
