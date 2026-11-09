import { Prisma, PlatformAdminRole } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CursorPage } from 'src/common/pagination';
import { PasswordService } from 'src/modules/auth/application/services/password.service';
import { ListAdminsQueryDto } from '../../presentation/dto/list-admins.dto';
import { AdminAuditService } from './admin-audit.service';
import { AdminSessionService } from './admin-session.service';
declare const SAFE_ADMIN_SELECT: {
    id: true;
    email: true;
    name: true;
    role: true;
    isActive: true;
    totpEnabled: true;
    mustChangePassword: true;
    passwordChangedAt: true;
    lastLoginAt: true;
    lastLoginIp: true;
    createdAt: true;
    updatedAt: true;
};
export type SafeAdmin = Prisma.PlatformAdminGetPayload<{
    select: typeof SAFE_ADMIN_SELECT;
}>;
export declare class AdminManagementService {
    private readonly prisma;
    private readonly passwords;
    private readonly sessions;
    private readonly audit;
    constructor(prisma: PrismaService, passwords: PasswordService, sessions: AdminSessionService, audit: AdminAuditService);
    list(query: ListAdminsQueryDto): Promise<CursorPage<SafeAdmin>>;
    get(id: string): Promise<SafeAdmin>;
    create(actorId: string, input: {
        email: string;
        name: string;
        role: PlatformAdminRole;
    }): Promise<{
        admin: SafeAdmin;
        temporaryPassword: string;
    }>;
    update(actorId: string, id: string, input: {
        name?: string;
        role?: PlatformAdminRole;
    }): Promise<SafeAdmin>;
    deactivate(actorId: string, id: string): Promise<SafeAdmin>;
    activate(actorId: string, id: string): Promise<SafeAdmin>;
    resetTwoFactor(actorId: string, id: string): Promise<SafeAdmin>;
    resetPassword(actorId: string, id: string): Promise<{
        admin: SafeAdmin;
        temporaryPassword: string;
    }>;
    private getEntity;
    private assertNotLastSuper;
}
export {};
