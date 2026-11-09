import { AuditAction } from '@prisma/client';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
export declare class SessionService {
    private readonly authRepository;
    constructor(authRepository: AuthRepository);
    createSession(data: {
        userId: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
    }): import("@prisma/client").Prisma.Prisma__SessionClient<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: import("@prisma/client").$Enums.SessionStatus;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        lastUsedAt: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    listUserSessions(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: import("@prisma/client").$Enums.SessionStatus;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        lastUsedAt: Date | null;
    }[]>;
    findSessionById(sessionId: string): import("@prisma/client").Prisma.Prisma__SessionClient<({
        user: {
            email: string;
            name: string;
            id: string;
            permissionsVersion: number;
            isBlocked: boolean;
            preferredLanguage: import("@prisma/client").$Enums.Language;
            deletedAt: Date | null;
        };
    } & {
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: import("@prisma/client").$Enums.SessionStatus;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        lastUsedAt: Date | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeSessionForUser(sessionId: string, userId: string, auditAction: AuditAction): Promise<{
        sessionId: string;
        revokedRefreshTokens: number;
    } | null>;
    revokeAllSessionsForUser(userId: string): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
    }>;
}
