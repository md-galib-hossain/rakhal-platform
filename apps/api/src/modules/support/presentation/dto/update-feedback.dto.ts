import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackStatus } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `PATCH /admin/feedback/:id` — triage: move status and/or add an internal note. */
export class UpdateFeedbackDto {
  @IsEnum(FeedbackStatus)
  status!: FeedbackStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
