import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { ListAdminAuditQueryDto } from '../../presentation/dto/list-admin-audit.dto';
import { PlatformAdminAuditLog } from '@prisma/client';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { AdminAuditAction, AdminAuditOutcome } from '../../domain/admin-audit-actions';
export declare class AdminAuditService {
    private readonly prisma;
    private readonly requestContext;
    private readonly log;
    constructor(prisma: PrismaService, requestContext: LoggerContext, logger: LoggerService);
    record(data: {
        adminId?: string | null;
        action: AdminAuditAction;
        entityType: string;
        entityId?: string | null;
        metadata?: Record<string, unknown> | null;
        before?: Record<string, unknown> | null;
        after?: Record<string, unknown> | null;
        outcome?: AdminAuditOutcome;
        actorEmail?: string | null;
        ipAddress?: string | null;
        userAgent?: string | null;
        sessionId?: string | null;
        requestId?: string | null;
    }): Promise<void>;
    list(query: ListAdminAuditQueryDto): Promise<CursorPage<PlatformAdminAuditLog>>;
}
