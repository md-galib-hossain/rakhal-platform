import { FeedbackStatus } from '@prisma/client';
export declare class UpdateFeedbackDto {
    status: FeedbackStatus;
    adminNote?: string;
}
