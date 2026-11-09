import { AdminAuditService } from '../../application/services/admin-audit.service';
import { ListAdminAuditQueryDto } from '../dto/list-admin-audit.dto';
export declare class AdminAuditController {
    private readonly audit;
    constructor(audit: AdminAuditService);
    list(query: ListAdminAuditQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        requestId: string | null;
        sessionId: string | null;
        action: string;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        outcome: string;
        before: import("@prisma/client/runtime/client").JsonValue | null;
        after: import("@prisma/client/runtime/client").JsonValue | null;
        adminId: string | null;
        actorEmail: string | null;
    }>>;
}
