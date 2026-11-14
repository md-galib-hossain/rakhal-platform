import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NotificationSchedule } from '@prisma/client';
import { ExceptionCode } from 'src/common/exceptions/exception-codes.enum';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso, zonedToUtc } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  AudienceMember,
  AudienceWriteError,
  MAX_RECIPIENTS,
  resolveAudience,
  validateManualAudience,
} from '../../domain/audience';
import {
  addDaysYmd,
  advanceSeries,
  allDayAnchorFromYmd,
  allDayAnchorYmd,
  anchorFromEntity,
  anchorLocalYmd,
  endOfDayKey,
  firstLiveAnchor,
  isAnchorInFuture,
  localParts,
  normalizeLeads,
  PlannedOccurrence,
  ScheduleRepeatType,
  validateLeads,
  validateRepeat,
} from '../../domain/schedule-math';
import type { CreateNotificationScheduleDto } from '../../presentation/dto/create-notification-schedule.dto';
import type { ListNotificationSchedulesQueryDto } from '../../presentation/dto/list-notification-schedules-query.dto';
import type { UpcomingNotificationsQueryDto } from '../../presentation/dto/upcoming-notifications-query.dto';
import type { UpdateNotificationScheduleDto } from '../../presentation/dto/update-notification-schedule.dto';
import { NOTIFICATION_CLOCK } from '../queue/notification-clock';
import type { NotificationClock } from '../queue/notification-clock';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';
import {
  ManualScheduleInput,
  NotificationScheduler,
} from './notification-scheduler.service';

export const MAX_ACTIVE_PER_USER = 50;
export const MAX_ACTIVE_PER_FARM = 500;
const PREVIEW_COUNT = 5;
const DEFAULT_UPCOMING_DAYS = 14;
const MAX_UPCOMING_DAYS = 90;
const DEFAULT_SEND_TIME = '08:00';

type Anchor = { type: 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP'; id: string };

/** Normalised create/edit input in farm-local terms; the one thing create, update and preview all compile. */
interface Draft {
  title: string;
  body: string | null;
  trigger: 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT';
  date?: string;
  time?: string | null;
  anchor?: Anchor | null;
  offsetDays?: number | null;
  repeat: { type: string; interval?: number | null; endDate?: string | null };
  leads: number[];
  audience: {
    mode: 'USER' | 'ROLES' | 'USERS';
    userId?: string | null;
    roles: string[];
    userIds: string[];
  };
  animalIds: string[];
}

export interface Actor {
  userId: string;
  canManage: boolean;
}

type Series = NonNullable<Parameters<typeof firstLiveAnchor>[0]>;

interface Compiled {
  input: ManualScheduleInput;
  timezone: string;
  plan: ReturnType<typeof firstLiveAnchor>;
  series: Series;
}

function invalid(code: string, message: string, field?: string) {
  return new UnprocessableEntityException({
    code: ExceptionCode.VALIDATION_ERROR,
    message,
    details: { code, field },
  });
}

const AUDIENCE_MESSAGES: Record<AudienceWriteError, string> = {
  AUDIENCE_SOURCE_NOT_ALLOWED: 'Audience mode is not allowed',
  AUDIENCE_USER_REQUIRED: 'Exactly one user is required',
  AUDIENCE_USERS_REQUIRED: 'At least one user is required',
  AUDIENCE_ROLES_REQUIRED: 'At least one role is required',
  AUDIENCE_TOO_MANY: `At most ${MAX_RECIPIENTS} recipients`,
  AUDIENCE_FORBIDDEN: 'You can only notify yourself',
};

function isRealDate(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && addDaysYmd(ymd, 0) === ymd;
}

/**
 * Manual (USER) notification schedules (RAKHAL-494, docs/EPIC_NOTIFICATIONS_V2.md §4). Owns validation, limits,
 * farm-tz -> UTC and RBAC, then hands an already computed `baseAnchorAt` to `NotificationScheduler`.
 */
@Injectable()
export class NotificationScheduleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmClock: FarmClockService,
    private readonly scheduler: NotificationScheduler,
    private readonly registry: SourceResolverRegistry,
    @Inject(NOTIFICATION_CLOCK) private readonly clock: NotificationClock,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(NotificationScheduleService.name);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------------------------------------------

  async create(
    farmId: string,
    actor: Actor,
    dto: CreateNotificationScheduleDto,
  ) {
    const compiled = await this.compile(farmId, actor, this.fromDto(dto));
    await this.assertLimits(farmId, actor.userId);
    const row = await this.scheduler.createManual(
      farmId,
      actor.userId,
      compiled.input,
    );
    const next = await this.nextFireTimes([row.id]);
    return this.view(row, actor, compiled.timezone, next.get(row.id) ?? null);
  }

  /** Same body as create. Writes nothing; returns the instants the real create would schedule. */
  async preview(
    farmId: string,
    actor: Actor,
    dto: CreateNotificationScheduleDto,
  ) {
    const compiled = await this.compile(farmId, actor, this.fromDto(dto));
    const now = this.clock.now();
    const fires: PlannedOccurrence[] = [];
    let step = compiled.plan;
    while (step && fires.length < PREVIEW_COUNT) {
      fires.push(...step.occurrences);
      step = advanceSeries(compiled.series, step.seriesIndex, now);
    }
    fires.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
    const next = fires.slice(0, PREVIEW_COUNT).map((p) => ({
      fire_at: p.fireAt.toISOString(),
      local: this.localIso(p.fireAt, compiled.timezone),
      lead_minutes: p.leadMinutes,
    }));
    const recipients = resolveAudience(
      {
        mode: compiled.input.audienceMode,
        userIds: compiled.input.audienceUserIds ?? [],
        roles: compiled.input.audienceRoles ?? [],
      },
      await this.loadMembers(farmId),
    );
    return {
      timezone: compiled.timezone,
      all_day: compiled.input.allDay,
      next_fire_times: next,
      recipient_count: recipients.length,
    };
  }

  async update(
    farmId: string,
    actor: Actor,
    id: string,
    dto: UpdateNotificationScheduleDto,
  ) {
    const row = await this.loadEditable(farmId, actor, id);
    const timezone = await this.farmClock.timezone(farmId);
    const draft = this.overlay(this.fromRow(row, timezone), dto);
    const { input } = await this.compile(farmId, actor, draft);
    const updated = await this.scheduler.updateManual(farmId, id, {
      ...input,
      body: input.body ?? null,
      anchorType: input.anchorType ?? null,
      anchorId: input.anchorId ?? null,
      offsetDays: input.offsetDays ?? null,
      repeatEndDate: input.repeatEndDate ?? null,
      repeatInterval: input.repeatInterval ?? null,
    });
    const next = await this.nextFireTimes([id]);
    return this.view(updated, actor, timezone, next.get(id) ?? null);
  }

  async pause(farmId: string, actor: Actor, id: string) {
    const row = await this.loadEditable(farmId, actor, id);
    if (row.status === 'ACTIVE') await this.scheduler.pause(farmId, id);
    return this.get(farmId, actor, id);
  }

  async resume(farmId: string, actor: Actor, id: string) {
    const row = await this.loadEditable(farmId, actor, id);
    if (row.status === 'PAUSED') await this.scheduler.resume(farmId, id);
    return this.get(farmId, actor, id);
  }

  async cancel(farmId: string, actor: Actor, id: string) {
    await this.loadEditable(farmId, actor, id, true);
    await this.scheduler.cancel(farmId, id);
    return { id, status: 'CANCELLED' };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------------------------------------------

  async get(farmId: string, actor: Actor, id: string) {
    const row = await this.loadVisible(farmId, actor, id);
    const next = await this.nextFireTimes([id]);
    return this.view(
      row,
      actor,
      await this.farmClock.timezone(farmId),
      next.get(id) ?? null,
    );
  }

  async list(
    farmId: string,
    actor: Actor,
    query: ListNotificationSchedulesQueryDto,
  ) {
    if (query.scope === 'farm' && !actor.canManage) {
      throw new ForbiddenException(
        'Listing the whole farm needs notification.manage',
      );
    }
    const rows = await this.prisma.notificationSchedule.findMany({
      where: {
        farmId,
        origin: 'USER',
        ...(query.scope === 'mine' ? { createdBy: actor.userId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const timezone = await this.farmClock.timezone(farmId);
    const next = await this.nextFireTimes(page.items.map((r) => r.id));
    return {
      items: page.items.map((r) =>
        this.view(r, actor, timezone, next.get(r.id) ?? null),
      ),
      meta: page.meta,
    };
  }

  /** Occurrences still to fire that target the caller: their own schedules, or audiences naming them or their role. */
  async upcoming(
    farmId: string,
    actor: Actor,
    query: UpcomingNotificationsQueryDto,
  ) {
    const timezone = await this.farmClock.timezone(farmId);
    const fromYmd = query.from ?? localDateIso(timezone, this.clock.now());
    const toYmd = query.to ?? addDaysYmd(fromYmd, DEFAULT_UPCOMING_DAYS);
    if (!isRealDate(fromYmd) || !isRealDate(toYmd) || toYmd < fromYmd) {
      throw invalid('RANGE_INVALID', 'Invalid from/to range', 'to');
    }
    const days =
      (Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) /
      86_400_000;
    if (days > MAX_UPCOMING_DAYS) {
      throw invalid(
        'RANGE_TOO_LONG',
        `Window is at most ${MAX_UPCOMING_DAYS} days`,
        'to',
      );
    }
    const roles = await this.rolesOf(farmId, actor.userId);
    const rows = await this.prisma.notificationOccurrence.findMany({
      where: {
        farmId,
        status: 'SCHEDULED',
        fireAt: {
          gte: zonedToUtc(timezone, fromYmd, '00:00'),
          lt: zonedToUtc(timezone, addDaysYmd(toYmd, 1), '00:00'),
        },
        schedule: {
          status: 'ACTIVE',
          OR: [
            { createdBy: actor.userId },
            { audienceUserIds: { has: actor.userId } },
            ...(roles.length ? [{ audienceRoles: { hasSome: roles } }] : []),
          ],
        },
      },
      include: { schedule: true },
      orderBy: [{ fireAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const copy = await this.systemCopy(farmId, timezone, page.items);
    const items = page.items.flatMap((o) => {
      const s = o.schedule;
      const sys =
        s.origin === 'SYSTEM'
          ? copy.get(`${s.id}:${o.leadMinutes}`)
          : undefined;
      // A SYSTEM row whose source is gone (or unresolvable) is hidden; the fire-time re-check would cancel it anyway.
      if (s.origin === 'SYSTEM' && !sys) return [];
      return [
        {
          occurrence_id: o.id,
          schedule_id: s.id,
          fire_at: o.fireAt.toISOString(),
          fire_at_local: this.localIso(o.fireAt, timezone),
          title: sys?.title ?? s.title ?? '',
          body: sys?.message ?? s.body ?? null,
          origin: s.origin,
          category: s.category,
          priority: s.priority,
          link:
            sys?.link ??
            (s.animalIds.length === 1
              ? `/animals?view=${s.animalIds[0]}`
              : null),
          animals_count: s.animalIds.length,
          repeat: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
          can_edit:
            s.origin === 'USER' &&
            (s.createdBy === actor.userId || actor.canManage),
        },
      ];
    });
    return { items, meta: page.meta };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Compile: the one place that turns a farm-local draft into a UTC ManualScheduleInput
  // ---------------------------------------------------------------------------------------------------------------

  private async compile(
    farmId: string,
    actor: Actor,
    d: Draft,
  ): Promise<Compiled> {
    const timezone = await this.farmClock.timezone(farmId);
    const now = this.clock.now();

    // Audience: shape + permission, then existence in THIS farm (404, so other farms' ids are never confirmed).
    const userIds =
      d.audience.mode === 'USER'
        ? d.audience.userId
          ? [d.audience.userId]
          : []
        : d.audience.userIds;
    const audienceError = validateManualAudience(
      { mode: d.audience.mode, userIds, roles: d.audience.roles },
      actor.userId,
      actor.canManage,
    );
    if (audienceError === 'AUDIENCE_FORBIDDEN') {
      throw new ForbiddenException(AUDIENCE_MESSAGES[audienceError]);
    }
    if (audienceError) {
      throw invalid(
        audienceError,
        AUDIENCE_MESSAGES[audienceError],
        'audience',
      );
    }
    await this.assertAudienceExists(
      farmId,
      d.audience.mode,
      userIds,
      d.audience.roles,
    );
    const animalIds = [...new Set(d.animalIds)];
    if (animalIds.length > 0) {
      const found = await this.prisma.cattle.count({
        where: { id: { in: animalIds }, farmId, deletedAt: null },
      });
      if (found !== animalIds.length) {
        throw new NotFoundException('Animal not found');
      }
    }

    // When.
    let baseAnchorAt: Date;
    let allDay: boolean;
    const time = d.time ?? null;
    let offsetDays: number | null = null;
    let anchorType: Anchor['type'] | null = null;
    let anchorId: string | null = null;
    if (d.trigger === 'DATE') {
      if (!d.date || !isRealDate(d.date)) {
        throw invalid('DATE_REQUIRED', 'A valid date is required', 'date');
      }
      allDay = time === null;
      baseAnchorAt =
        time === null
          ? allDayAnchorFromYmd(d.date)
          : zonedToUtc(timezone, d.date, time);
    } else {
      if (!d.anchor) {
        throw invalid('ANCHOR_REQUIRED', 'An anchor is required', 'anchor');
      }
      if (d.offsetDays == null) {
        throw invalid(
          'OFFSET_REQUIRED',
          'offset_days is required',
          'offset_days',
        );
      }
      const entity = await this.loadAnchor(farmId, d.anchor, timezone);
      const entityTime = time ?? entity.time;
      allDay = entityTime === null;
      const entityAt =
        entityTime === null
          ? allDayAnchorFromYmd(entity.ymd)
          : zonedToUtc(timezone, entity.ymd, entityTime);
      if (
        d.trigger === 'BEFORE_EVENT' &&
        d.anchor.type === 'ANIMAL_EVENT' &&
        !isAnchorInFuture(entityAt, now)
      ) {
        throw invalid(
          'ANCHOR_NOT_IN_FUTURE',
          'That event is already in the past',
          'anchor',
        );
      }
      baseAnchorAt = anchorFromEntity({
        trigger: d.trigger,
        entityAt,
        offsetDays: d.offsetDays,
        allDay,
        timezone,
      });
      offsetDays = d.offsetDays;
      anchorType = d.anchor.type;
      anchorId = d.anchor.id;
    }

    // Leads (default: at the anchor).
    const leads = normalizeLeads(d.leads.length ? d.leads : [0]);
    const leadError = validateLeads(leads, allDay);
    if (leadError) {
      throw invalid(
        leadError,
        `Invalid lead_minutes (${leadError})`,
        'lead_minutes',
      );
    }

    // Repeat.
    const repeat: ScheduleRepeatType =
      d.repeat.type === 'NEVER'
        ? 'NONE'
        : (d.repeat.type as ScheduleRepeatType);
    const startYmd = anchorLocalYmd(baseAnchorAt, allDay, timezone);
    const repeatError = validateRepeat({
      repeat,
      repeatInterval: d.repeat.interval,
      endDateYmd: d.repeat.endDate,
      startYmd,
    });
    if (repeatError) {
      throw invalid(repeatError, `Invalid repeat (${repeatError})`, 'repeat');
    }
    let repeatEndDate: Date | null = null;
    if (repeat !== 'NONE' && d.repeat.endDate) {
      if (!isRealDate(d.repeat.endDate)) {
        throw invalid('REPEAT_END_INVALID', 'Invalid end_date', 'repeat');
      }
      repeatEndDate = endOfDayKey(d.repeat.endDate);
    }
    const repeatInterval =
      repeat === 'EVERY_N_DAYS' ? (d.repeat.interval ?? null) : null;

    const input: ManualScheduleInput = {
      title: d.title,
      body: d.body,
      trigger: d.trigger,
      baseAnchorAt,
      allDay,
      sendTime: DEFAULT_SEND_TIME,
      leadMinutes: leads,
      offsetDays,
      anchorType,
      anchorId,
      repeat,
      repeatInterval,
      repeatEndDate,
      audienceMode: d.audience.mode,
      audienceUserIds: userIds,
      audienceRoles: d.audience.mode === 'ROLES' ? d.audience.roles : [],
      animalIds,
    };
    const series: Series = {
      baseAnchorAt,
      allDay,
      repeat,
      repeatInterval,
      repeatEndDate,
      timezone,
      sendTime: DEFAULT_SEND_TIME,
      leadMinutes: leads,
    };
    const plan = firstLiveAnchor(series, 0, now);
    if (!plan) {
      throw invalid(
        'NO_FUTURE_OCCURRENCE',
        'Nothing would ever fire: the time has already passed',
        d.trigger === 'DATE' ? 'date' : 'anchor',
      );
    }
    return { input, timezone, plan, series };
  }

  private async assertAudienceExists(
    farmId: string,
    mode: 'USER' | 'ROLES' | 'USERS',
    userIds: string[],
    roles: string[],
  ) {
    if (mode === 'ROLES') {
      const names = [...new Set(roles)];
      const found = await this.prisma.role.findMany({
        where: {
          name: { in: names },
          OR: [{ isSystemRole: true }, { farmId }],
        },
        select: { name: true },
      });
      if (new Set(found.map((r) => r.name)).size !== names.length) {
        throw new NotFoundException('Role not found');
      }
      return;
    }
    const ids = [...new Set(userIds)];
    const members = await this.prisma.farmMember.findMany({
      where: { farmId, userId: { in: ids }, user: { deletedAt: null } },
      select: { userId: true },
    });
    if (new Set(members.map((m) => m.userId)).size !== ids.length) {
      throw new NotFoundException('User not found');
    }
  }

  /** The anchor entity's farm-local date (and wall time when it has one). 404 when absent or in another farm. */
  private async loadAnchor(
    farmId: string,
    anchor: Anchor,
    timezone: string,
  ): Promise<{ ymd: string; time: string | null }> {
    const notFound = new NotFoundException('Anchor not found');
    switch (anchor.type) {
      case 'ANIMAL_EVENT': {
        const e = await this.prisma.animalEvent.findFirst({
          where: { id: anchor.id, farmId, voidedAt: null },
          select: { eventAt: true, dateApprox: true },
        });
        if (!e) throw notFound;
        const p = localParts(e.eventAt, timezone);
        return { ymd: p.ymd, time: e.dateApprox ? null : p.hm };
      }
      case 'TASK': {
        const t = await this.prisma.task.findFirst({
          where: { id: anchor.id, farmId },
          select: { dueAt: true },
        });
        if (!t) throw notFound;
        return { ymd: localParts(t.dueAt, timezone).ymd, time: null };
      }
      case 'HEALTH_STEP': {
        const h = await this.prisma.healthTask.findFirst({
          where: { id: anchor.id, farmId },
          select: { dueDateTime: true, timeOfDay: true },
        });
        if (!h) throw notFound;
        const p = localParts(h.dueDateTime, timezone);
        return { ymd: p.ymd, time: h.timeOfDay ? p.hm : null };
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Draft plumbing
  // ---------------------------------------------------------------------------------------------------------------

  private fromDto(dto: CreateNotificationScheduleDto): Draft {
    return {
      title: dto.title,
      body: dto.body?.length ? dto.body : null,
      trigger: dto.trigger,
      date: dto.date,
      time: dto.time ?? null,
      anchor: dto.anchor ?? null,
      offsetDays: dto.offset_days ?? null,
      repeat: {
        type: dto.repeat?.type ?? 'NEVER',
        interval: dto.repeat?.interval ?? null,
        endDate: dto.repeat?.end_date ?? null,
      },
      leads: dto.lead_minutes ?? [],
      audience: {
        mode: dto.audience.mode,
        userId: dto.audience.user_id ?? null,
        roles: dto.audience.roles ?? [],
        userIds: dto.audience.user_ids ?? [],
      },
      animalIds: dto.animal_ids ?? [],
    };
  }

  private fromRow(s: NotificationSchedule, timezone: string): Draft {
    return {
      title: s.title ?? '',
      body: s.body,
      trigger: s.trigger as Draft['trigger'],
      date:
        s.trigger === 'DATE'
          ? anchorLocalYmd(s.baseAnchorAt, s.allDay, timezone)
          : undefined,
      time: s.allDay ? null : localParts(s.baseAnchorAt, timezone).hm,
      anchor:
        s.anchorType && s.anchorId
          ? { type: s.anchorType, id: s.anchorId }
          : null,
      offsetDays: s.offsetDays,
      repeat: {
        type: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
        interval: s.repeatInterval,
        endDate: s.repeatEndDate ? allDayAnchorYmd(s.repeatEndDate) : null,
      },
      leads: s.leadMinutes,
      audience: {
        mode: s.audienceMode as Draft['audience']['mode'],
        userId: s.audienceUserIds[0] ?? null,
        roles: s.audienceRoles,
        userIds: s.audienceUserIds,
      },
      animalIds: s.animalIds,
    };
  }

  private overlay(base: Draft, p: UpdateNotificationScheduleDto): Draft {
    const next: Draft = { ...base };
    if (p.title !== undefined) next.title = p.title;
    if (p.body !== undefined) next.body = p.body.length ? p.body : null;
    if (p.trigger !== undefined) {
      next.trigger = p.trigger;
      if (p.trigger === 'DATE') {
        next.anchor = null;
        next.offsetDays = null;
      }
    }
    if (p.date !== undefined) next.date = p.date;
    if (p.time !== undefined) next.time = p.time;
    if (p.anchor !== undefined) next.anchor = p.anchor;
    if (p.offset_days !== undefined) next.offsetDays = p.offset_days;
    if (p.repeat !== undefined) {
      next.repeat = {
        type: p.repeat.type,
        interval: p.repeat.interval ?? null,
        endDate: p.repeat.end_date ?? null,
      };
    }
    if (p.lead_minutes !== undefined) next.leads = p.lead_minutes;
    if (p.audience !== undefined) {
      next.audience = {
        mode: p.audience.mode,
        userId: p.audience.user_id ?? null,
        roles: p.audience.roles ?? [],
        userIds: p.audience.user_ids ?? [],
      };
    }
    if (p.animal_ids !== undefined) next.animalIds = p.animal_ids;
    return next;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Access, limits, views
  // ---------------------------------------------------------------------------------------------------------------

  /** Farm-scoped load (404 across farms). SYSTEM schedules are read-only (409). */
  private async loadVisible(farmId: string, actor: Actor, id: string) {
    const row = await this.prisma.notificationSchedule.findFirst({
      where: { id, farmId },
    });
    if (!row) throw new NotFoundException('Schedule not found');
    if (row.origin !== 'USER') {
      throw new ConflictException('System schedules are read-only');
    }
    if (row.createdBy !== actor.userId && !actor.canManage) {
      throw new ForbiddenException('Not your schedule');
    }
    return row;
  }

  private async loadEditable(
    farmId: string,
    actor: Actor,
    id: string,
    allowDone = false,
  ) {
    const row = await this.loadVisible(farmId, actor, id);
    const editable = allowDone
      ? row.status !== 'CANCELLED'
      : row.status === 'ACTIVE' || row.status === 'PAUSED';
    if (!editable) {
      throw new ConflictException(`Schedule is ${row.status.toLowerCase()}`);
    }
    return row;
  }

  private async assertLimits(farmId: string, userId: string) {
    const live: { status: { in: ('ACTIVE' | 'PAUSED')[] } } = {
      status: { in: ['ACTIVE', 'PAUSED'] },
    };
    const [mine, farm] = await Promise.all([
      this.prisma.notificationSchedule.count({
        where: { farmId, origin: 'USER', createdBy: userId, ...live },
      }),
      this.prisma.notificationSchedule.count({
        where: { farmId, origin: 'USER', ...live },
      }),
    ]);
    if (mine >= MAX_ACTIVE_PER_USER) {
      throw invalid(
        'SCHEDULE_LIMIT',
        `At most ${MAX_ACTIVE_PER_USER} active notifications per user`,
      );
    }
    if (farm >= MAX_ACTIVE_PER_FARM) {
      throw invalid(
        'SCHEDULE_LIMIT',
        `At most ${MAX_ACTIVE_PER_FARM} active notifications per farm`,
      );
    }
  }

  private async nextFireTimes(ids: string[]): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    if (ids.length === 0) return out;
    const rows = await this.prisma.notificationOccurrence.findMany({
      where: { scheduleId: { in: ids }, status: 'SCHEDULED' },
      select: { scheduleId: true, fireAt: true },
      orderBy: { fireAt: 'asc' },
    });
    for (const r of rows) {
      if (!out.has(r.scheduleId)) out.set(r.scheduleId, r.fireAt);
    }
    return out;
  }

  private async rolesOf(farmId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.farmMember.findMany({
      where: { farmId, userId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((r) => r.role.name);
  }

  private async loadMembers(farmId: string): Promise<AudienceMember[]> {
    const rows = await this.prisma.farmMember.findMany({
      where: { farmId },
      select: {
        userId: true,
        role: { select: { name: true } },
        user: { select: { deletedAt: true } },
      },
    });
    const byUser = new Map<string, { roles: string[]; active: boolean }>();
    for (const r of rows) {
      const m = byUser.get(r.userId) ?? {
        roles: [],
        active: r.user.deletedAt === null,
      };
      m.roles.push(r.role.name);
      byUser.set(r.userId, m);
    }
    return [...byUser.entries()].map(([userId, m]) => ({ userId, ...m }));
  }

  /**
   * Title/body/link of SYSTEM rows: one resolver call per distinct (schedule, lead) on the page, keyed
   * `${scheduleId}:${leadMinutes}` — the copy depends on the occurrence's own lead (1-day lead != day-of).
   */
  private async systemCopy(
    farmId: string,
    timezone: string,
    occurrences: Array<{
      leadMinutes: number;
      anchorAt: Date;
      schedule: NotificationSchedule;
    }>,
  ) {
    const out = new Map<
      string,
      { title: string; message: string; link?: string }
    >();
    const seen = new Map<string, (typeof occurrences)[number]>();
    for (const o of occurrences) {
      const s = o.schedule;
      if (s.origin === 'SYSTEM' && s.sourceType && s.sourceKey) {
        seen.set(`${s.id}:${o.leadMinutes}`, o);
      }
    }
    const now = this.clock.now();
    await Promise.all(
      [...seen.entries()].map(async ([copyKey, o]) => {
        const s = o.schedule;
        const resolver = s.sourceType
          ? this.registry.get(s.sourceType)
          : undefined;
        if (!resolver) {
          out.set(copyKey, {
            title: s.title ?? 'Scheduled notice',
            message: '',
          });
          return;
        }
        try {
          const r = await resolver.resolve({
            farmId,
            sourceKey: s.sourceKey ?? '',
            timezone,
            now,
            leadMinutes: o.leadMinutes,
            anchorAt: o.anchorAt,
          });
          if (r.state === 'OK') {
            out.set(copyKey, {
              title: r.title,
              message: r.message,
              link: r.link,
            });
          }
        } catch (err) {
          this.log.warn('Upcoming: resolver failed', {
            scheduleId: s.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
    return out;
  }

  private localIso(instant: Date, timezone: string): string {
    const p = localParts(instant, timezone);
    return `${p.ymd}T${p.hm}`;
  }

  private view(
    s: NotificationSchedule,
    actor: Actor,
    timezone: string,
    nextFireAt: Date | null,
  ) {
    return {
      id: s.id,
      title: s.title,
      body: s.body,
      status: s.status,
      trigger: s.trigger,
      date:
        s.trigger === 'DATE'
          ? anchorLocalYmd(s.baseAnchorAt, s.allDay, timezone)
          : null,
      time: s.allDay ? null : localParts(s.baseAnchorAt, timezone).hm,
      all_day: s.allDay,
      anchor:
        s.anchorType && s.anchorId
          ? { type: s.anchorType, id: s.anchorId }
          : null,
      offset_days: s.offsetDays,
      repeat: {
        type: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
        interval: s.repeatInterval,
        end_date: s.repeatEndDate ? allDayAnchorYmd(s.repeatEndDate) : null,
      },
      lead_minutes: s.leadMinutes,
      audience: {
        mode: s.audienceMode,
        user_ids: s.audienceUserIds,
        roles: s.audienceRoles,
      },
      animal_ids: s.animalIds,
      created_by: s.createdBy,
      next_fire_at: nextFireAt ? nextFireAt.toISOString() : null,
      created_at: s.createdAt.toISOString(),
      can_edit: s.createdBy === actor.userId || actor.canManage,
    };
  }
}
