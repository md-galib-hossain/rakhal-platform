import { IsEnum, IsOptional } from 'class-validator';
import { FeedbackStatus } from '@prisma/client';

/** `GET /admin/feedback` filter (RAKHAL-242). */
export class ListFeedbackQueryDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;
}
