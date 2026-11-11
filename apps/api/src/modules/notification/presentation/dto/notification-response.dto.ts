import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationOrigin,
  ScheduleAnchorType,
  ScheduleAudienceMode,
  ScheduleStatus,
  ScheduleTrigger,
  type Prisma,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { ChannelRouterService } from '../../application/services/channel-router.service';
import type { DeviceTokenService } from '../../application/services/device-token.service';
import type { NotificationScheduleService } from '../../application/services/notification-schedule.service';
import type { NotificationService } from '../../application/services/notification.service';
import type { TelegramLinkService } from '../../application/services/telegram-link.service';
import type { NotificationCategory } from '../../domain/notification-events';

/**
 * Documented response shapes for the notification routes typed under RD-140. Each class mirrors what the
 * service really returns and is pinned to it by a compile-time guard at the bottom of this file, so a change
 * in a service fails `nest build` until this file follows. Keys are snake_case where the service builds the
 * response by hand and camelCase where it does not (devices, Telegram), exactly as on the wire.
 *
 * Note on `GET /notifications`: it is NOT a cursor page. The response is
 * `{ unread_count, notifications, meta: { page, per_page, total } }`, and because it has no `items` key the
 * response interceptor wraps it whole as `{ success, data }`.
 *
 * Not documented: `POST /notifications/telegram/webhook` (an inbound callback from Telegram, not an API
 * clients call).
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const CATEGORY = [
  'health_safety',
  'reproduction',
  'operational',
  'financial',
  'inventory',
] as const;

// ─── In-app notifications ──────────────────────────────────────────────────

export class NotificationItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() priority!: string;
  @ApiProperty() title!: string;
  @ApiProperty() message!: string;
  @ApiProperty(NULLABLE_STRING) link!: string | null;
  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Free-form payload attached to the notification (JSON).',
  })
  data!: Prisma.JsonValue;
  @ApiProperty() read!: boolean;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

export class NotificationPageMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() per_page!: number;
  @ApiProperty() total!: number;
}

export class NotificationListResponseDto {
  @ApiProperty() unread_count!: number;
  @ApiProperty({ type: () => [NotificationItemDto] })
  notifications!: NotificationItemDto[];
  @ApiProperty({ type: () => NotificationPageMetaDto })
  meta!: NotificationPageMetaDto;
}

export class MarkReadResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() read!: boolean;
}

export class MarkAllReadResponseDto {
  @ApiProperty({ description: 'How many notifications were marked read.' })
  updated!: number;
}

// ─── Preferences and channel routing ───────────────────────────────────────

export class NotificationChannelsDto {
  @ApiProperty() in_app!: boolean;
  @ApiProperty() push!: boolean;
  @ApiProperty() sms!: boolean;
  @ApiProperty() whatsapp!: boolean;
  @ApiProperty() telegram!: boolean;
  @ApiProperty() email!: boolean;
}

export class QuietHoursDto {
  @ApiProperty(NULLABLE_STRING) start!: string | null;
  @ApiProperty(NULLABLE_STRING) end!: string | null;
}

export class PreferenceItemDto {
  @ApiProperty() event_key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: CATEGORY, enumName: 'NotificationCategory' })
  category!: NotificationCategory;
  @ApiProperty({
    description: 'False for mandatory (health and safety) events.',
  })
  can_disable!: boolean;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ type: () => NotificationChannelsDto })
  channels!: NotificationChannelsDto;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({ type: () => QuietHoursDto }) quiet_hours!: QuietHoursDto;
  @ApiProperty({ type: () => [PreferenceItemDto] })
  preferences!: PreferenceItemDto[];
}

export class RoutingEventDto {
  @ApiProperty() event_key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: CATEGORY, enumName: 'NotificationCategory' })
  category!: NotificationCategory;
  @ApiProperty() can_disable!: boolean;
  @ApiProperty({ type: () => NotificationChannelsDto })
  channels!: NotificationChannelsDto;
  @ApiProperty({ description: 'True when this farm overrides the default.' })
  farm_override!: boolean;
}

export class ChannelRoutingResponseDto {
  @ApiProperty({ type: () => [RoutingEventDto] }) events!: RoutingEventDto[];
}

// ─── Devices ───────────────────────────────────────────────────────────────

export class RegisterDeviceResponseDto {
  @ApiProperty() registered!: boolean;
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() provider!: string;
}

export class DeviceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() provider!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) lastSeenAt!: Date;
}

export class UnregisterDeviceResponseDto {
  @ApiProperty() removed!: boolean;
}

// ─── Telegram ──────────────────────────────────────────────────────────────

export class TelegramLinkTokenResponseDto {
  @ApiProperty() configured!: boolean;
  @ApiProperty(NULLABLE_STRING) deepLink!: string | null;
}

export class TelegramChatDto {
  @ApiProperty() id!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

export class TelegramStatusResponseDto {
  @ApiProperty() configured!: boolean;
  @ApiProperty() linked!: boolean;
  @ApiProperty() count!: number;
  @ApiProperty({ type: () => [TelegramChatDto] }) chats!: TelegramChatDto[];
}

export class TelegramConnectSessionResponseDto {
  @ApiProperty() configured!: boolean;
  @ApiProperty() botUsername!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ description: 'Seconds until the code expires.' })
  expiresIn!: number;
  @ApiProperty() deepLink!: string;
  @ApiProperty() qrPayload!: string;
}

export class UnlinkTelegramResponseDto {
  @ApiProperty() unlinked!: boolean;
  @ApiProperty() count!: number;
}

// ─── Schedules (custom reminders) ──────────────────────────────────────────

export class ScheduleAnchorDto {
  @ApiProperty({ enum: ScheduleAnchorType, enumName: 'ScheduleAnchorType' })
  type!: ScheduleAnchorType;
  @ApiProperty() id!: string;
}

export class ScheduleRepeatDto {
  @ApiProperty() type!: string;
  @ApiProperty({ type: Number, nullable: true }) interval!: number | null;
  @ApiProperty(NULLABLE_STRING) end_date!: string | null;
}

export class ScheduleAudienceDto {
  @ApiProperty({
    enum: ScheduleAudienceMode,
    enumName: 'ScheduleAudienceMode',
  })
  mode!: ScheduleAudienceMode;
  @ApiProperty({ type: [String] }) user_ids!: string[];
  @ApiProperty({ type: [String] }) roles!: string[];
}

export class NotificationScheduleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty(NULLABLE_STRING) title!: string | null;
  @ApiProperty(NULLABLE_STRING) body!: string | null;
  @ApiProperty({ enum: ScheduleStatus, enumName: 'ScheduleStatus' })
  status!: ScheduleStatus;
  @ApiProperty({ enum: ScheduleTrigger, enumName: 'ScheduleTrigger' })
  trigger!: ScheduleTrigger;
  @ApiProperty(NULLABLE_STRING) date!: string | null;
  @ApiProperty(NULLABLE_STRING) time!: string | null;
  @ApiProperty() all_day!: boolean;
  @ApiProperty({ type: () => ScheduleAnchorDto, nullable: true })
  anchor!: ScheduleAnchorDto | null;
  @ApiProperty({ type: Number, nullable: true }) offset_days!: number | null;
  @ApiProperty({ type: () => ScheduleRepeatDto }) repeat!: ScheduleRepeatDto;
  @ApiProperty({ type: [Number] }) lead_minutes!: number[];
  @ApiProperty({ type: () => ScheduleAudienceDto })
  audience!: ScheduleAudienceDto;
  @ApiProperty({ type: [String] }) animal_ids!: string[];
  @ApiProperty(NULLABLE_STRING) created_by!: string | null;
  @ApiProperty(NULLABLE_STRING) next_fire_at!: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() can_edit!: boolean;
}

export class CancelScheduleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
}

export class SchedulePreviewFireTimeDto {
  @ApiProperty() fire_at!: string;
  @ApiProperty() local!: string;
  @ApiProperty() lead_minutes!: number;
}

export class SchedulePreviewResponseDto {
  @ApiProperty() timezone!: string;
  @ApiProperty() all_day!: boolean;
  @ApiProperty({ type: () => [SchedulePreviewFireTimeDto] })
  next_fire_times!: SchedulePreviewFireTimeDto[];
  @ApiProperty() recipient_count!: number;
}

export class UpcomingOccurrenceDto {
  @ApiProperty() occurrence_id!: string;
  @ApiProperty() schedule_id!: string;
  @ApiProperty() fire_at!: string;
  @ApiProperty() fire_at_local!: string;
  @ApiProperty() title!: string;
  @ApiProperty(NULLABLE_STRING) body!: string | null;
  @ApiProperty({ enum: NotificationOrigin, enumName: 'NotificationOrigin' })
  origin!: NotificationOrigin;
  @ApiProperty() category!: string;
  @ApiProperty() priority!: string;
  @ApiProperty(NULLABLE_STRING) link!: string | null;
  @ApiProperty() animals_count!: number;
  @ApiProperty() repeat!: string;
  @ApiProperty() can_edit!: boolean;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Notif = NotificationService;
type Sched = NotificationScheduleService;
type Router = ChannelRouterService;
type Tg = TelegramLinkService;
type Dev = DeviceTokenService;

export type NotificationShapeGuards = [
  Assert<Same<Ret<Notif, 'list'>, NotificationListResponseDto>>,
  Assert<Same<Ret<Notif, 'markRead'>, MarkReadResponseDto>>,
  Assert<Same<Ret<Notif, 'markAllRead'>, MarkAllReadResponseDto>>,
  Assert<
    Same<Ret<Notif, 'getPreferences'>, NotificationPreferencesResponseDto>
  >,
  Assert<
    Same<Ret<Notif, 'updatePreferences'>, NotificationPreferencesResponseDto>
  >,
  Assert<Same<Ret<Router, 'getFarmRouting'>, ChannelRoutingResponseDto>>,
  Assert<Same<Ret<Router, 'setFarmRule'>, ChannelRoutingResponseDto>>,
  Assert<Same<Ret<Router, 'deleteFarmRule'>, ChannelRoutingResponseDto>>,
  Assert<Same<Ret<Dev, 'register'>, RegisterDeviceResponseDto>>,
  Assert<Same<Ret<Dev, 'list'>, DeviceResponseDto[]>>,
  Assert<Same<Ret<Dev, 'unregister'>, UnregisterDeviceResponseDto>>,
  Assert<Same<Ret<Tg, 'mintLinkToken'>, TelegramLinkTokenResponseDto>>,
  Assert<Same<Ret<Tg, 'getUserStatus'>, TelegramStatusResponseDto>>,
  Assert<
    Same<Ret<Tg, 'mintConnectSession'>, TelegramConnectSessionResponseDto>
  >,
  Assert<Same<Ret<Tg, 'unlinkUser'>, UnlinkTelegramResponseDto>>,
  Assert<Same<Ret<Sched, 'create'>, NotificationScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'update'>, NotificationScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'get'>, NotificationScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'pause'>, NotificationScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'resume'>, NotificationScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'list'>, CursorPage<NotificationScheduleResponseDto>>>,
  Assert<Same<Ret<Sched, 'cancel'>, CancelScheduleResponseDto>>,
  Assert<Same<Ret<Sched, 'preview'>, SchedulePreviewResponseDto>>,
  Assert<Same<Ret<Sched, 'upcoming'>, CursorPage<UpcomingOccurrenceDto>>>,
];
