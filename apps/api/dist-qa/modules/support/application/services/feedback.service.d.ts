import { FeedbackStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MediaService } from 'src/modules/media/application/services/media.service';
import { CreateFeedbackDto } from '../../presentation/dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../../presentation/dto/update-feedback.dto';
export declare class FeedbackService {
    private readonly prisma;
    private readonly media;
    private readonly log;
    constructor(prisma: PrismaService, media: MediaService, logger: LoggerService);
    submit(farmId: string, userId: string, dto: CreateFeedbackDto, file?: {
        buffer: Buffer;
        originalname?: string;
        size?: number;
    }): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        created_at: string;
    }>;
    listForAdmin(status?: FeedbackStatus): Promise<{
        id: string;
        farm_id: string;
        user_id: string;
        category: import("@prisma/client").$Enums.SupportCategory;
        message: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        admin_note: string | null;
        screenshot: import("src/modules/media/application/services/media.service").MediaUrls | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        created_at: string;
    }[]>;
    updateStatus(id: string, adminId: string, dto: UpdateFeedbackDto): Promise<{
        id: string;
        farm_id: string;
        user_id: string;
        category: import("@prisma/client").$Enums.SupportCategory;
        message: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        admin_note: string | null;
        screenshot: import("src/modules/media/application/services/media.service").MediaUrls | null;
        resolved_by_admin_id: string | null;
        resolved_at: string | null;
        created_at: string;
    }>;
    private presentAdmin;
}
