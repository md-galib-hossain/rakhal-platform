import { BadRequestException, Injectable } from '@nestjs/common';
import { RoutingScope } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  getEvent,
  NOTIFICATION_EVENTS,
  NotificationChannel,
  NotificationChannels,
} from '../../domain/notification-events';

const ALL_CHANNELS: NotificationChannel[] = [
  'in_app',
  'push',
  'sms',
  'whatsapp',
  'telegram',
  'email',
];

/**
 * Channel routing resolver (RAKHAL-256, PRD §20.1a). Decides **which channels an
 * event uses** — resolved most-specific-first (NRT-01): FARM+event → FARM+category
 * → GLOBAL+event → GLOBAL+category → the built-in code default (event catalogue).
 * The in-app bell is always on (NRT-03). Farms manage their overrides here;
 * GLOBAL (platform) rules are authored by the admin surface (RAKHAL-224/225).
 */
@Injectable()
export class ChannelRouterService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ChannelRouterService.name);
  }

  /** Resolve the candidate channel set for an event on a farm (NRT-01). */
  async resolveChannels(
    eventKey: string,
    category: string,
    farmId: string,
  ): Promise<NotificationChannels> {
    const rules = await this.prisma.notificationRoutingRule.findMany({
      where: {
        enabled: true,
        OR: [
          { scope: RoutingScope.FARM, farmId, eventKey },
          { scope: RoutingScope.FARM, farmId, eventKey: null, category },
          { scope: RoutingScope.GLOBAL, eventKey },
          { scope: RoutingScope.GLOBAL, eventKey: null, category },
        ],
      },
    });

    const pick =
      rules.find((r) => r.scope === 'FARM' && r.eventKey === eventKey) ??
      rules.find(
        (r) =>
          r.scope === 'FARM' && r.eventKey === null && r.category === category,
      ) ??
      rules.find((r) => r.scope === 'GLOBAL' && r.eventKey === eventKey) ??
      rules.find(
        (r) =>
          r.scope === 'GLOBAL' &&
          r.eventKey === null &&
          r.category === category,
      );

    if (pick) return this.toChannels(pick.channels);
    return getEvent(eventKey)?.defaultChannels ?? this.toChannels([]);
  }

  /** The farm's effective routing for every event, flagging its own overrides. */
  async getFarmRouting(farmId: string) {
    const farmRules = await this.prisma.notificationRoutingRule.findMany({
      where: { scope: RoutingScope.FARM, farmId },
      select: { eventKey: true },
    });
    const overridden = new Set(
      farmRules.map((r) => r.eventKey).filter((k): k is string => Boolean(k)),
    );

    const events = await Promise.all(
      NOTIFICATION_EVENTS.map(async (e) => ({
        event_key: e.key,
        label: e.label,
        category: e.category,
        can_disable: e.canDisable,
        channels: await this.resolveChannels(e.key, e.category, farmId),
        farm_override: overridden.has(e.key),
      })),
    );
    return { events };
  }

  /** Upsert a per-farm override for one event (NRT-06, `customer-api`). */
  async setFarmRule(farmId: string, eventKey: string, channels: string[]) {
    const event = getEvent(eventKey);
    if (!event) {
      throw new BadRequestException(`Unknown notification event: ${eventKey}`);
    }
    const valid = [...new Set(channels)].filter((c): c is NotificationChannel =>
      (ALL_CHANNELS as string[]).includes(c),
    );

    const existing = await this.prisma.notificationRoutingRule.findFirst({
      where: { scope: RoutingScope.FARM, farmId, eventKey },
    });
    if (existing) {
      await this.prisma.notificationRoutingRule.update({
        where: { id: existing.id },
        data: { channels: valid, enabled: true },
      });
    } else {
      await this.prisma.notificationRoutingRule.create({
        data: { scope: RoutingScope.FARM, farmId, eventKey, channels: valid },
      });
    }
    this.log.info('Farm routing rule set', {
      farmId,
      eventKey,
      channels: valid,
    });
    return this.getFarmRouting(farmId);
  }

  /** Remove a per-farm override (revert to global/built-in). */
  async deleteFarmRule(farmId: string, eventKey: string) {
    await this.prisma.notificationRoutingRule.deleteMany({
      where: { scope: RoutingScope.FARM, farmId, eventKey },
    });
    return this.getFarmRouting(farmId);
  }

  private toChannels(arr: string[]): NotificationChannels {
    return {
      in_app: true, // the bell always delivers (NRT-03)
      push: arr.includes('push'),
      sms: arr.includes('sms'),
      whatsapp: arr.includes('whatsapp'),
      telegram: arr.includes('telegram'),
      email: arr.includes('email'),
    };
  }
}
