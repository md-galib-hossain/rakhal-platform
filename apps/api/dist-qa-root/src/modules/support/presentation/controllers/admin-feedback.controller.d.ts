import { AdminAuditService } from 'src/modules/admin/application/services/admin-audit.service';
import type { CurrentAdminContext } from 'src/modules/admin/domain/authenticated-admin-request.type';
import { FeedbackService } from '../../application/services/feedback.service';
import { ListFeedbackQueryDto } from '../dto/list-feedback-query.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';
export declare class AdminFeedbackController {
    private readonly feedback;
    private readonly audit;
    constructor(feedback: FeedbackService, audit: AdminAuditService);
    list(query: ListFeedbackQueryDto): Promise<{
        id: string;
        farm_id: string;
        user_id: string;
        category: import("@prisma/client").$Enums.SupportCategory;
        message: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        admin_note: string | null;
        screenshot: import("../../../media/application/services/media.service").MediaUrls | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        created_at: string;
    }[]>;
    update(admin: CurrentAdminContext, id: string, dto: UpdateFeedbackDto): Promise<{
        id: string;
        farm_id: string;
        user_id: string;
        category: import("@prisma/client").$Enums.SupportCategory;
        message: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        admin_note: string | null;
        screenshot: import("../../../media/application/services/media.service").MediaUrls | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        created_at: string;
    }>;
}
