import { ApiProperty } from '@nestjs/swagger';
import type { AdminCommunicationsService } from '../../application/services/admin-communications.service';

/**
 * Documented response shapes for admin communications (`/admin/communications/*`, admin-api, RD-140). Each
 * class mirrors what `AdminCommunicationsService` returns and is pinned to it by a compile-time guard at the
 * bottom of this file.
 */

/** GET /admin/communications/stats. */
export class AdminChannelStatsResponseDto {
  @ApiProperty() totalUsers!: number;
  @ApiProperty() telegramSubscribers!: number;
  @ApiProperty() pushSubscribers!: number;
}

export class AdminMessageRecipientDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

/** POST /admin/communications/users/:id/message. */
export class AdminDirectMessageResponseDto {
  @ApiProperty() delivered!: boolean;
  @ApiProperty({ type: () => AdminMessageRecipientDto })
  recipient!: AdminMessageRecipientDto;
}

/** POST /admin/communications/broadcast. */
export class AdminBroadcastResponseDto {
  @ApiProperty() targetedCount!: number;
  @ApiProperty() deliveredCount!: number;
  @ApiProperty({
    required: false,
    description: 'Present only when the service returns an explanatory note.',
  })
  message?: string;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Comms<K extends keyof AdminCommunicationsService> =
  AdminCommunicationsService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type AdminCommunicationsShapeGuards = [
  Assert<Same<Comms<'getChannelStats'>, AdminChannelStatsResponseDto>>,
  Assert<Same<Comms<'sendDirectMessage'>, AdminDirectMessageResponseDto>>,
  // broadcast returns a union (with / without `message`): both branches must fit the documented class.
  Assert<Comms<'broadcast'> extends AdminBroadcastResponseDto ? true : false>,
];
