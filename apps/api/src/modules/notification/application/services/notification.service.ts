import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  externalChannels,
  getEvent,
  isKnownEvent,
  NOTIFICATION_EVENTS,
  NotificationChannel,
  NotificationChannels,
} from '../../domain/notification-events';

/** Channels that ping a device — suppressed during a user's quiet hours (PRD §20.3). */
const QUIET_HOURS_SUPPRESSED = new Set<NotificationChannel>([
  'push',
  'sms',
  'whatsapp',
  'telegram',
]);
import { NotificationDeliveryService } from './notification-delivery.service';
import { ChannelRouterService } from './channel-router.service';
import { ListNotificationQueryDto } from '../../presentation/dto/list-notification-query.dto';
import { UpdatePreferencesDto } from '../../presentation/dto/update-preferences.dto';

/** Recipients + content for an internal `notifyUsers` call (other modules emit these). */
export interface NotifyInput {
  farmId: string;
  userIds: string[];
  eventKey: string;
  title: string;
  message: string;
  link?: string;
  /** Idempotency key — recipients already holding a notification with this key are skipped. */
  dedupeKey?: string;
}

/**
 * Notification engine (PRD §20 / API §17, RAKHAL-098/099).
 *
 * `notifyUsers` is the **internal API** other modules call on their events (the
 * same pattern as `TaskService.createInternal`). It resolves each recipient's
 * effective preference (catalogue default merged with the user's overrides),
 * honours mandatory health/safety events (cannot be disabled), suppresses SMS/
 * WhatsApp during quiet hours, writes the in-app `Notification`, and routes the
 * external channels to the (stubbed) delivery seam. HTTP routes cover the bell
 * feed (list / mark-read / unread count) and preferences.
 */
@Injectable()
export class NotificationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
    private readonly router: ChannelRouterService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(NotificationService.name);
  }

  // ---- internal emit API --------------------------------------------------

  /**
   * Emit to every member of the farm holding one of `roleNames` (resolves the
   * recipients, then delegates to {@link notifyUsers}). The one-liner emitters in
   * other modules use this so recipient resolution lives in one place.
   */
  async notifyFarmRoles(
    input: Omit<NotifyInput, 'userIds'> & { roleNames: string[] },
  ) {
    const members = await this.prisma.farmMember.findMany({
      where: { farmId: input.farmId, role: { name: { in: input.roleNames } } },
      select: { userId: true },
    });
    return this.notifyUsers({
      farmId: input.farmId,
      userIds: members.map((m) => m.userId),
      eventKey: input.eventKey,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
    });
  }

  /** Emit to the farm's Owner + Manager(s) — the common "alert the bosses" target. */
  notifyOwnersAndManagers(input: Omit<NotifyInput, 'userIds'>) {
    return this.notifyFarmRoles({ ...input, roleNames: ['Owner', 'Manager'] });
  }

  async notifyUsers(input: NotifyInput) {
    const event = getEvent(input.eventKey);
    if (!event) {
      throw new Error(`Unknown notification event: ${input.eventKey}`);
    }
    let userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return [];

    // Idempotency: drop recipients who already hold this dedupe key (recurring sweeps).
    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findMany({
        where: { userId: { in: userIds }, dedupeKey: input.dedupeKey },
        select: { userId: true },
      });
      const seen = new Set(existing.map((e) => e.userId));
      userIds = userIds.filter((id) => !seen.has(id));
      if (userIds.length === 0) return [];
    }

    const [overrides, settings] = await Promise.all([
      this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, eventKey: event.key },
      }),
      this.prisma.notificationSetting.findMany({
        where: { userId: { in: userIds } },
      }),
    ]);
    const overrideByUser = new Map(overrides.map((o) => [o.userId, o]));
    const settingByUser = new Map(settings.map((s) => [s.userId, s]));
    const nowHm = this.nowHm();

    // Admin/farm-configurable channel routing (RAKHAL-256, §20.1a) — resolved
    // once per emit; it replaces the hard-coded catalogue default as the base
    // channel set. A user's own per-event override still wins for that user.
    const routed = await this.router.resolveChannels(
      event.key,
      event.category,
      input.farmId,
    );

    const created: Notification[] = [];
    for (const userId of userIds) {
      const override = overrideByUser.get(userId);

      // Mandatory events ignore overrides; opt-out only applies to disablable ones.
      const enabled = event.canDisable ? (override?.enabled ?? true) : true;
      if (!enabled) continue;

      const channels: NotificationChannels =
        event.canDisable && override
          ? {
              in_app: override.inApp,
              push: override.push,
              sms: override.sms,
              whatsapp: override.whatsapp,
              telegram: override.telegram,
              email: override.email,
            }
          : routed;

      const setting = settingByUser.get(userId);
      const quiet = this.inQuietHours(
        nowHm,
        setting?.quietHoursStart ?? null,
        setting?.quietHoursEnd ?? null,
      );

      const sent: string[] = [];
      const dispatch: NotificationChannel[] = [];
      if (channels.in_app) sent.push('in_app');
      for (const ch of externalChannels(channels)) {
        if (quiet && QUIET_HOURS_SUPPRESSED.has(ch)) continue;
        sent.push(ch);
        dispatch.push(ch);
      }

      const notification = await this.prisma.notification.create({
        data: {
          farmId: input.farmId,
          userId,
          eventKey: event.key,
          category: event.category,
          priority: event.priority,
          title: input.title,
          message: input.message,
          link: input.link,
          channelsSent: sent,
          dedupeKey: input.dedupeKey,
        },
      });
      created.push(notification);

      // External channels go through the dispatcher (best-effort; never blocks
      // the in-app row that was just persisted).
      for (const ch of dispatch) {
        try {
          await this.delivery.deliver(ch, {
            userId,
            eventKey: event.key,
            category: event.category,
            priority: event.priority,
            title: input.title,
            message: input.message,
            link: input.link,
          });
        } catch (err) {
          this.log.warn('Channel dispatch threw', {
            channel: ch,
            err: (err as Error).message,
          });
        }
      }
    }

    this.log.info('Notifications emitted', {
      eventKey: event.key,
      recipients: created.length,
    });
    return created;
  }

  // ---- bell feed ----------------------------------------------------------

  async list(farmId: string, userId: string, query: ListNotificationQueryDto) {
    const baseWhere = { farmId, userId };
    const where =
      query.status === 'unread' ? { ...baseWhere, isRead: false } : baseWhere;
    const perPage = query.per_page;
    const offset = (query.page - 1) * perPage;

    const [unreadCount, total, rows] = await Promise.all([
      this.prisma.notification.count({
        where: { ...baseWhere, isRead: false },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: perPage,
      }),
    ]);

    return {
      unread_count: unreadCount,
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.category,
        priority: n.priority,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.isRead,
        created_at: n.createdAt,
      })),
      meta: { page: query.page, per_page: perPage, total },
    };
  }

  async markRead(farmId: string, userId: string, id: string) {
    const res = await this.prisma.notification.updateMany({
      where: { id, farmId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    if (res.count === 0) {
      // Either not found, not yours, or already read — disambiguate not-found.
      const exists = await this.prisma.notification.findFirst({
        where: { id, farmId, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { id, read: true };
  }

  async markAllRead(farmId: string, userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { farmId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: res.count };
  }

  // ---- preferences --------------------------------------------------------

  async getPreferences(farmId: string, userId: string) {
    const [overrides, setting] = await Promise.all([
      this.prisma.notificationPreference.findMany({ where: { userId } }),
      this.prisma.notificationSetting.findFirst({ where: { userId } }),
    ]);
    const byKey = new Map(overrides.map((o) => [o.eventKey, o]));

    return {
      quiet_hours: {
        start: setting?.quietHoursStart ?? null,
        end: setting?.quietHoursEnd ?? null,
      },
      preferences: NOTIFICATION_EVENTS.map((e) => {
        const o = byKey.get(e.key);
        const channels = o
          ? {
              in_app: o.inApp,
              push: o.push,
              sms: o.sms,
              whatsapp: o.whatsapp,
              telegram: o.telegram,
              email: o.email,
            }
          : e.defaultChannels;
        return {
          event_key: e.key,
          label: e.label,
          category: e.category,
          can_disable: e.canDisable,
          enabled: e.canDisable ? (o?.enabled ?? true) : true,
          channels,
        };
      }),
    };
  }

  async updatePreferences(
    farmId: string,
    userId: string,
    dto: UpdatePreferencesDto,
  ) {
    if (dto.quiet_hours) {
      await this.prisma.notificationSetting.upsert({
        where: { userId },
        create: {
          farmId,
          userId,
          quietHoursStart: dto.quiet_hours.start,
          quietHoursEnd: dto.quiet_hours.end,
        },
        update: {
          quietHoursStart: dto.quiet_hours.start,
          quietHoursEnd: dto.quiet_hours.end,
        },
      });
    }

    for (const pref of dto.preferences ?? []) {
      const event = getEvent(pref.event_key);
      if (!event || !isKnownEvent(pref.event_key)) {
        throw new BadRequestException(
          `Unknown notification event: ${pref.event_key}`,
        );
      }
      if (!event.canDisable && pref.enabled === false) {
        throw new BadRequestException(
          `"${event.label}" is a mandatory health & safety alert and cannot be disabled`,
        );
      }
      const channels = pref.channels ?? event.defaultChannels;
      await this.prisma.notificationPreference.upsert({
        where: { userId_eventKey: { userId, eventKey: event.key } },
        create: {
          farmId,
          userId,
          eventKey: event.key,
          enabled: pref.enabled ?? true,
          inApp: channels.in_app,
          push: channels.push,
          sms: channels.sms,
          whatsapp: channels.whatsapp,
          telegram: channels.telegram,
          email: channels.email,
        },
        update: {
          ...(pref.enabled !== undefined ? { enabled: pref.enabled } : {}),
          ...(pref.channels
            ? {
                inApp: channels.in_app,
                push: channels.push,
                sms: channels.sms,
                whatsapp: channels.whatsapp,
                telegram: channels.telegram,
                email: channels.email,
              }
            : {}),
        },
      });
    }

    return this.getPreferences(farmId, userId);
  }

  // ---- helpers ------------------------------------------------------------

  private nowHm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** True if `hm` falls within [start, end), handling the overnight wrap (22:00→05:00). */
  private inQuietHours(
    hm: string,
    start: string | null,
    end: string | null,
  ): boolean {
    if (!start || !end) return false;
    if (start === end) return false;
    return start < end ? hm >= start && hm < end : hm >= start || hm < end; // wraps past midnight
  }
}
