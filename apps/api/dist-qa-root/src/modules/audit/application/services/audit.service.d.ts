import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    record(data: {
        actorUserId: string;
        action: AuditAction;
        entityType: string;
        entityId?: string | null;
        farmId?: string | null;
        metadata?: Record<string, unknown> | null;
        ipAddress?: string;
        userAgent?: string;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logLogin(data: {
        actorUserId: string;
        sessionId: string;
        farmId?: string | null;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logLogout(data: {
        actorUserId: string;
        sessionId: string;
        farmId?: string | null;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logSessionRevoked(data: {
        actorUserId: string;
        sessionId: string;
        farmId?: string | null;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logPasswordChanged(data: {
        actorUserId: string;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logRefreshReuse(data: {
        actorUserId: string;
        sessionId: string;
        farmId?: string | null;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logRoleChanged(data: {
        actorUserId: string;
        farmId?: string | null;
        entityId?: string;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logMembershipChanged(data: {
        actorUserId: string;
        farmId?: string | null;
        entityId?: string;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    logSubscriptionChanged(data: {
        actorUserId: string;
        farmId?: string | null;
        entityId?: string;
        metadata?: Record<string, unknown>;
    }): Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
}
