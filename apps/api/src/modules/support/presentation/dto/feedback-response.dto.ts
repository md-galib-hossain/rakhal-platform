import { ApiProperty } from '@nestjs/swagger';
import { FeedbackStatus, SupportCategory } from '@prisma/client';
import { MediaUrlsDto } from 'src/modules/inventory/presentation/dto/inventory-response.dto';
import type { FeedbackService } from '../../application/services/feedback.service';

/**
 * Documented response shape for the admin support inbox (`/admin/feedback`, admin-api, RD-140). Mirrors
 * `FeedbackService.presentAdmin` and is pinned to it by a compile-time guard at the bottom of this file.
 * Timestamps are already ISO-8601 strings. The screenshot URLs are signed and expire (`expires_at`).
 */
export class AdminFeedbackDto {
  @ApiProperty() id!: string;
  @ApiProperty() farm_id!: string;
  @ApiProperty() user_id!: string;
  @ApiProperty({ enum: SupportCategory, enumName: 'SupportCategory' })
  category!: SupportCategory;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: FeedbackStatus, enumName: 'FeedbackStatus' })
  status!: FeedbackStatus;
  @ApiProperty({ type: String, nullable: true }) admin_note!: string | null;
  @ApiProperty({
    type: () => MediaUrlsDto,
    nullable: true,
    description:
      'Signed screenshot URLs; null when none was attached or the asset is gone.',
  })
  screenshot!: MediaUrlsDto | null;
  @ApiProperty({ type: String, nullable: true })
  resolved_by_admin_id!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolved_at!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: string;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

export type AdminFeedbackShapeGuards = [
  Assert<Same<Ret<FeedbackService, 'listForAdmin'>, AdminFeedbackDto[]>>,
  Assert<Same<Ret<FeedbackService, 'updateStatus'>, AdminFeedbackDto>>,
];
