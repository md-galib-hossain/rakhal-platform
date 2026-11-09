import { PlatformAdmin, PlatformAdminSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AdminAuditService } from './admin-audit.service';
export declare const ADMIN_REFRESH_TTL_MS: number;
export interface AdminClientContext {
    ipAddress?: string;
    userAgent?: string;
}
export interface IssuedAdminSession {
    session: PlatformAdminSession;
    refreshToken: string;
}
export declare function hashRefreshToken(token: string): string;
export declare class AdminSessionService {
    private readonly prisma;
    private readonly audit;
    private readonly log;
    constructor(prisma: PrismaService, audit: AdminAuditService, logger: LoggerService);
    create(adminId: string, client: AdminClientContext): Promise<IssuedAdminSession>;
    rotate(presented: string, client: AdminClientContext): Promise<IssuedAdminSession & {
        admin: PlatformAdmin;
    }>;
    private handlePossibleReuse;
    isActive(sessionId: string, adminId: string): Promise<boolean>;
    listActive(adminId: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        lastUsedAt: Date | null;
    }[]>;
    revoke(adminId: string, sessionId: string, reason: string, ipAddress?: string): Promise<boolean>;
    revokeAll(adminId: string, reason: string, exceptSessionId?: string, ipAddress?: string): Promise<number>;
}
