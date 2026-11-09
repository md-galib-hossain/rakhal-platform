import { FeedbackService } from '../../application/services/feedback.service';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
export declare class FeedbackController {
    private readonly feedback;
    constructor(feedback: FeedbackService);
    submit(farmId: string, userId: string, dto: CreateFeedbackDto, file?: Express.Multer.File): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        created_at: string;
    }>;
}
