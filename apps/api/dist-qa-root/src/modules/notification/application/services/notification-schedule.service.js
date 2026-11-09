"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationScheduleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationScheduleService = exports.MAX_ACTIVE_PER_FARM = exports.MAX_ACTIVE_PER_USER = void 0;
const common_1 = require("@nestjs/common");
const exception_codes_enum_1 = require("src/common/exceptions/exception-codes.enum");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const audience_1 = require("../../domain/audience");
const schedule_math_1 = require("../../domain/schedule-math");
const notification_clock_1 = require("../queue/notification-clock");
const source_resolver_registry_1 = require("../resolvers/source-resolver.registry");
const notification_scheduler_service_1 = require("./notification-scheduler.service");
exports.MAX_ACTIVE_PER_USER = 50;
exports.MAX_ACTIVE_PER_FARM = 500;
const PREVIEW_COUNT = 5;
const DEFAULT_UPCOMING_DAYS = 14;
const MAX_UPCOMING_DAYS = 90;
const DEFAULT_SEND_TIME = '08:00';
function invalid(code, message, field) {
    return new common_1.UnprocessableEntityException({
        code: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
        message,
        details: { code, field },
    });
}
const AUDIENCE_MESSAGES = {
    AUDIENCE_SOURCE_NOT_ALLOWED: 'Audience mode is not allowed',
    AUDIENCE_USER_REQUIRED: 'Exactly one user is required',
    AUDIENCE_USERS_REQUIRED: 'At least one user is required',
    AUDIENCE_ROLES_REQUIRED: 'At least one role is required',
    AUDIENCE_TOO_MANY: `At most ${audience_1.MAX_RECIPIENTS} recipients`,
    AUDIENCE_FORBIDDEN: 'You can only notify yourself',
};
function isRealDate(ymd) {
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && (0, schedule_math_1.addDaysYmd)(ymd, 0) === ymd;
}
let NotificationScheduleService = NotificationScheduleService_1 = class NotificationScheduleService {
    prisma;
    farmClock;
    scheduler;
    registry;
    clock;
    log;
    constructor(prisma, farmClock, scheduler, registry, clock, logger) {
        this.prisma = prisma;
        this.farmClock = farmClock;
        this.scheduler = scheduler;
        this.registry = registry;
        this.clock = clock;
        this.log = logger.setContext(NotificationScheduleService_1.name);
    }
    async create(farmId, actor, dto) {
        const compiled = await this.compile(farmId, actor, this.fromDto(dto));
        await this.assertLimits(farmId, actor.userId);
        const row = await this.scheduler.createManual(farmId, actor.userId, compiled.input);
        const next = await this.nextFireTimes([row.id]);
        return this.view(row, actor, compiled.timezone, next.get(row.id) ?? null);
    }
    async preview(farmId, actor, dto) {
        const compiled = await this.compile(farmId, actor, this.fromDto(dto));
        const now = this.clock.now();
        const fires = [];
        let step = compiled.plan;
        while (step && fires.length < PREVIEW_COUNT) {
            fires.push(...step.occurrences);
            step = (0, schedule_math_1.advanceSeries)(compiled.series, step.seriesIndex, now);
        }
        fires.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
        const next = fires.slice(0, PREVIEW_COUNT).map((p) => ({
            fire_at: p.fireAt.toISOString(),
            local: this.localIso(p.fireAt, compiled.timezone),
            lead_minutes: p.leadMinutes,
        }));
        const recipients = (0, audience_1.resolveAudience)({
            mode: compiled.input.audienceMode,
            userIds: compiled.input.audienceUserIds ?? [],
            roles: compiled.input.audienceRoles ?? [],
        }, await this.loadMembers(farmId));
        return {
            timezone: compiled.timezone,
            all_day: compiled.input.allDay,
            next_fire_times: next,
            recipient_count: recipients.length,
        };
    }
    async update(farmId, actor, id, dto) {
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
    async pause(farmId, actor, id) {
        const row = await this.loadEditable(farmId, actor, id);
        if (row.status === 'ACTIVE')
            await this.scheduler.pause(farmId, id);
        return this.get(farmId, actor, id);
    }
    async resume(farmId, actor, id) {
        const row = await this.loadEditable(farmId, actor, id);
        if (row.status === 'PAUSED')
            await this.scheduler.resume(farmId, id);
        return this.get(farmId, actor, id);
    }
    async cancel(farmId, actor, id) {
        await this.loadEditable(farmId, actor, id, true);
        await this.scheduler.cancel(farmId, id);
        return { id, status: 'CANCELLED' };
    }
    async get(farmId, actor, id) {
        const row = await this.loadVisible(farmId, actor, id);
        const next = await this.nextFireTimes([id]);
        return this.view(row, actor, await this.farmClock.timezone(farmId), next.get(id) ?? null);
    }
    async list(farmId, actor, query) {
        if (query.scope === 'farm' && !actor.canManage) {
            throw new common_1.ForbiddenException('Listing the whole farm needs notification.manage');
        }
        const rows = await this.prisma.notificationSchedule.findMany({
            where: {
                farmId,
                origin: 'USER',
                ...(query.scope === 'mine' ? { createdBy: actor.userId } : {}),
                ...(query.status ? { status: query.status } : {}),
            },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const timezone = await this.farmClock.timezone(farmId);
        const next = await this.nextFireTimes(page.items.map((r) => r.id));
        return {
            items: page.items.map((r) => this.view(r, actor, timezone, next.get(r.id) ?? null)),
            meta: page.meta,
        };
    }
    async upcoming(farmId, actor, query) {
        const timezone = await this.farmClock.timezone(farmId);
        const fromYmd = query.from ?? (0, farm_time_1.localDateIso)(timezone, this.clock.now());
        const toYmd = query.to ?? (0, schedule_math_1.addDaysYmd)(fromYmd, DEFAULT_UPCOMING_DAYS);
        if (!isRealDate(fromYmd) || !isRealDate(toYmd) || toYmd < fromYmd) {
            throw invalid('RANGE_INVALID', 'Invalid from/to range', 'to');
        }
        const days = (Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) /
            86_400_000;
        if (days > MAX_UPCOMING_DAYS) {
            throw invalid('RANGE_TOO_LONG', `Window is at most ${MAX_UPCOMING_DAYS} days`, 'to');
        }
        const roles = await this.rolesOf(farmId, actor.userId);
        const rows = await this.prisma.notificationOccurrence.findMany({
            where: {
                farmId,
                status: 'SCHEDULED',
                fireAt: {
                    gte: (0, farm_time_1.zonedToUtc)(timezone, fromYmd, '00:00'),
                    lt: (0, farm_time_1.zonedToUtc)(timezone, (0, schedule_math_1.addDaysYmd)(toYmd, 1), '00:00'),
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
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const copy = await this.systemCopy(farmId, timezone, page.items);
        const items = page.items.flatMap((o) => {
            const s = o.schedule;
            const sys = s.origin === 'SYSTEM' ? copy.get(s.id) : undefined;
            if (s.origin === 'SYSTEM' && !sys)
                return [];
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
                    link: sys?.link ??
                        (s.animalIds.length === 1
                            ? `/animals?view=${s.animalIds[0]}`
                            : null),
                    animals_count: s.animalIds.length,
                    repeat: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
                    can_edit: s.origin === 'USER' &&
                        (s.createdBy === actor.userId || actor.canManage),
                },
            ];
        });
        return { items, meta: page.meta };
    }
    async compile(farmId, actor, d) {
        const timezone = await this.farmClock.timezone(farmId);
        const now = this.clock.now();
        const userIds = d.audience.mode === 'USER'
            ? d.audience.userId
                ? [d.audience.userId]
                : []
            : d.audience.userIds;
        const audienceError = (0, audience_1.validateManualAudience)({ mode: d.audience.mode, userIds, roles: d.audience.roles }, actor.userId, actor.canManage);
        if (audienceError === 'AUDIENCE_FORBIDDEN') {
            throw new common_1.ForbiddenException(AUDIENCE_MESSAGES[audienceError]);
        }
        if (audienceError) {
            throw invalid(audienceError, AUDIENCE_MESSAGES[audienceError], 'audience');
        }
        await this.assertAudienceExists(farmId, d.audience.mode, userIds, d.audience.roles);
        const animalIds = [...new Set(d.animalIds)];
        if (animalIds.length > 0) {
            const found = await this.prisma.cattle.count({
                where: { id: { in: animalIds }, farmId, deletedAt: null },
            });
            if (found !== animalIds.length) {
                throw new common_1.NotFoundException('Animal not found');
            }
        }
        let baseAnchorAt;
        let allDay;
        const time = d.time ?? null;
        let offsetDays = null;
        let anchorType = null;
        let anchorId = null;
        if (d.trigger === 'DATE') {
            if (!d.date || !isRealDate(d.date)) {
                throw invalid('DATE_REQUIRED', 'A valid date is required', 'date');
            }
            allDay = time === null;
            baseAnchorAt =
                time === null
                    ? (0, schedule_math_1.allDayAnchorFromYmd)(d.date)
                    : (0, farm_time_1.zonedToUtc)(timezone, d.date, time);
        }
        else {
            if (!d.anchor) {
                throw invalid('ANCHOR_REQUIRED', 'An anchor is required', 'anchor');
            }
            if (d.offsetDays == null) {
                throw invalid('OFFSET_REQUIRED', 'offset_days is required', 'offset_days');
            }
            const entity = await this.loadAnchor(farmId, d.anchor, timezone);
            const entityTime = time ?? entity.time;
            allDay = entityTime === null;
            const entityAt = entityTime === null
                ? (0, schedule_math_1.allDayAnchorFromYmd)(entity.ymd)
                : (0, farm_time_1.zonedToUtc)(timezone, entity.ymd, entityTime);
            if (d.trigger === 'BEFORE_EVENT' &&
                d.anchor.type === 'ANIMAL_EVENT' &&
                !(0, schedule_math_1.isAnchorInFuture)(entityAt, now)) {
                throw invalid('ANCHOR_NOT_IN_FUTURE', 'That event is already in the past', 'anchor');
            }
            baseAnchorAt = (0, schedule_math_1.anchorFromEntity)({
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
        const leads = (0, schedule_math_1.normalizeLeads)(d.leads.length ? d.leads : [0]);
        const leadError = (0, schedule_math_1.validateLeads)(leads, allDay);
        if (leadError) {
            throw invalid(leadError, `Invalid lead_minutes (${leadError})`, 'lead_minutes');
        }
        const repeat = d.repeat.type === 'NEVER'
            ? 'NONE'
            : d.repeat.type;
        const startYmd = (0, schedule_math_1.anchorLocalYmd)(baseAnchorAt, allDay, timezone);
        const repeatError = (0, schedule_math_1.validateRepeat)({
            repeat,
            repeatInterval: d.repeat.interval,
            endDateYmd: d.repeat.endDate,
            startYmd,
        });
        if (repeatError) {
            throw invalid(repeatError, `Invalid repeat (${repeatError})`, 'repeat');
        }
        let repeatEndDate = null;
        if (repeat !== 'NONE' && d.repeat.endDate) {
            if (!isRealDate(d.repeat.endDate)) {
                throw invalid('REPEAT_END_INVALID', 'Invalid end_date', 'repeat');
            }
            repeatEndDate = (0, schedule_math_1.endOfDayKey)(d.repeat.endDate);
        }
        const repeatInterval = repeat === 'EVERY_N_DAYS' ? (d.repeat.interval ?? null) : null;
        const input = {
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
        const series = {
            baseAnchorAt,
            allDay,
            repeat,
            repeatInterval,
            repeatEndDate,
            timezone,
            sendTime: DEFAULT_SEND_TIME,
            leadMinutes: leads,
        };
        const plan = (0, schedule_math_1.firstLiveAnchor)(series, 0, now);
        if (!plan) {
            throw invalid('NO_FUTURE_OCCURRENCE', 'Nothing would ever fire: the time has already passed', d.trigger === 'DATE' ? 'date' : 'anchor');
        }
        return { input, timezone, plan, series };
    }
    async assertAudienceExists(farmId, mode, userIds, roles) {
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
                throw new common_1.NotFoundException('Role not found');
            }
            return;
        }
        const ids = [...new Set(userIds)];
        const members = await this.prisma.farmMember.findMany({
            where: { farmId, userId: { in: ids }, user: { deletedAt: null } },
            select: { userId: true },
        });
        if (new Set(members.map((m) => m.userId)).size !== ids.length) {
            throw new common_1.NotFoundException('User not found');
        }
    }
    async loadAnchor(farmId, anchor, timezone) {
        const notFound = new common_1.NotFoundException('Anchor not found');
        switch (anchor.type) {
            case 'ANIMAL_EVENT': {
                const e = await this.prisma.animalEvent.findFirst({
                    where: { id: anchor.id, farmId, voidedAt: null },
                    select: { eventAt: true, dateApprox: true },
                });
                if (!e)
                    throw notFound;
                const p = (0, schedule_math_1.localParts)(e.eventAt, timezone);
                return { ymd: p.ymd, time: e.dateApprox ? null : p.hm };
            }
            case 'TASK': {
                const t = await this.prisma.task.findFirst({
                    where: { id: anchor.id, farmId },
                    select: { dueAt: true },
                });
                if (!t)
                    throw notFound;
                return { ymd: (0, schedule_math_1.localParts)(t.dueAt, timezone).ymd, time: null };
            }
            case 'HEALTH_STEP': {
                const h = await this.prisma.healthTask.findFirst({
                    where: { id: anchor.id, farmId },
                    select: { dueDateTime: true, timeOfDay: true },
                });
                if (!h)
                    throw notFound;
                const p = (0, schedule_math_1.localParts)(h.dueDateTime, timezone);
                return { ymd: p.ymd, time: h.timeOfDay ? p.hm : null };
            }
        }
    }
    fromDto(dto) {
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
    fromRow(s, timezone) {
        return {
            title: s.title ?? '',
            body: s.body,
            trigger: s.trigger,
            date: s.trigger === 'DATE'
                ? (0, schedule_math_1.anchorLocalYmd)(s.baseAnchorAt, s.allDay, timezone)
                : undefined,
            time: s.allDay ? null : (0, schedule_math_1.localParts)(s.baseAnchorAt, timezone).hm,
            anchor: s.anchorType && s.anchorId
                ? { type: s.anchorType, id: s.anchorId }
                : null,
            offsetDays: s.offsetDays,
            repeat: {
                type: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
                interval: s.repeatInterval,
                endDate: s.repeatEndDate ? (0, schedule_math_1.allDayAnchorYmd)(s.repeatEndDate) : null,
            },
            leads: s.leadMinutes,
            audience: {
                mode: s.audienceMode,
                userId: s.audienceUserIds[0] ?? null,
                roles: s.audienceRoles,
                userIds: s.audienceUserIds,
            },
            animalIds: s.animalIds,
        };
    }
    overlay(base, p) {
        const next = { ...base };
        if (p.title !== undefined)
            next.title = p.title;
        if (p.body !== undefined)
            next.body = p.body.length ? p.body : null;
        if (p.trigger !== undefined) {
            next.trigger = p.trigger;
            if (p.trigger === 'DATE') {
                next.anchor = null;
                next.offsetDays = null;
            }
        }
        if (p.date !== undefined)
            next.date = p.date;
        if (p.time !== undefined)
            next.time = p.time;
        if (p.anchor !== undefined)
            next.anchor = p.anchor;
        if (p.offset_days !== undefined)
            next.offsetDays = p.offset_days;
        if (p.repeat !== undefined) {
            next.repeat = {
                type: p.repeat.type,
                interval: p.repeat.interval ?? null,
                endDate: p.repeat.end_date ?? null,
            };
        }
        if (p.lead_minutes !== undefined)
            next.leads = p.lead_minutes;
        if (p.audience !== undefined) {
            next.audience = {
                mode: p.audience.mode,
                userId: p.audience.user_id ?? null,
                roles: p.audience.roles ?? [],
                userIds: p.audience.user_ids ?? [],
            };
        }
        if (p.animal_ids !== undefined)
            next.animalIds = p.animal_ids;
        return next;
    }
    async loadVisible(farmId, actor, id) {
        const row = await this.prisma.notificationSchedule.findFirst({
            where: { id, farmId },
        });
        if (!row)
            throw new common_1.NotFoundException('Schedule not found');
        if (row.origin !== 'USER') {
            throw new common_1.ConflictException('System schedules are read-only');
        }
        if (row.createdBy !== actor.userId && !actor.canManage) {
            throw new common_1.ForbiddenException('Not your schedule');
        }
        return row;
    }
    async loadEditable(farmId, actor, id, allowDone = false) {
        const row = await this.loadVisible(farmId, actor, id);
        const editable = allowDone
            ? row.status !== 'CANCELLED'
            : row.status === 'ACTIVE' || row.status === 'PAUSED';
        if (!editable) {
            throw new common_1.ConflictException(`Schedule is ${row.status.toLowerCase()}`);
        }
        return row;
    }
    async assertLimits(farmId, userId) {
        const live = {
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
        if (mine >= exports.MAX_ACTIVE_PER_USER) {
            throw invalid('SCHEDULE_LIMIT', `At most ${exports.MAX_ACTIVE_PER_USER} active notifications per user`);
        }
        if (farm >= exports.MAX_ACTIVE_PER_FARM) {
            throw invalid('SCHEDULE_LIMIT', `At most ${exports.MAX_ACTIVE_PER_FARM} active notifications per farm`);
        }
    }
    async nextFireTimes(ids) {
        const out = new Map();
        if (ids.length === 0)
            return out;
        const rows = await this.prisma.notificationOccurrence.findMany({
            where: { scheduleId: { in: ids }, status: 'SCHEDULED' },
            select: { scheduleId: true, fireAt: true },
            orderBy: { fireAt: 'asc' },
        });
        for (const r of rows) {
            if (!out.has(r.scheduleId))
                out.set(r.scheduleId, r.fireAt);
        }
        return out;
    }
    async rolesOf(farmId, userId) {
        const rows = await this.prisma.farmMember.findMany({
            where: { farmId, userId },
            select: { role: { select: { name: true } } },
        });
        return rows.map((r) => r.role.name);
    }
    async loadMembers(farmId) {
        const rows = await this.prisma.farmMember.findMany({
            where: { farmId },
            select: {
                userId: true,
                role: { select: { name: true } },
                user: { select: { deletedAt: true } },
            },
        });
        const byUser = new Map();
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
    async systemCopy(farmId, timezone, occurrences) {
        const out = new Map();
        const seen = new Map();
        for (const o of occurrences) {
            const s = o.schedule;
            if (s.origin === 'SYSTEM' && s.sourceType && s.sourceKey) {
                seen.set(s.id, o);
            }
        }
        const now = this.clock.now();
        await Promise.all([...seen.entries()].map(async ([scheduleId, o]) => {
            const s = o.schedule;
            const resolver = s.sourceType
                ? this.registry.get(s.sourceType)
                : undefined;
            if (!resolver) {
                out.set(scheduleId, {
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
                    out.set(scheduleId, {
                        title: r.title,
                        message: r.message,
                        link: r.link,
                    });
                }
            }
            catch (err) {
                this.log.warn('Upcoming: resolver failed', {
                    scheduleId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }));
        return out;
    }
    localIso(instant, timezone) {
        const p = (0, schedule_math_1.localParts)(instant, timezone);
        return `${p.ymd}T${p.hm}`;
    }
    view(s, actor, timezone, nextFireAt) {
        return {
            id: s.id,
            title: s.title,
            body: s.body,
            status: s.status,
            trigger: s.trigger,
            date: s.trigger === 'DATE'
                ? (0, schedule_math_1.anchorLocalYmd)(s.baseAnchorAt, s.allDay, timezone)
                : null,
            time: s.allDay ? null : (0, schedule_math_1.localParts)(s.baseAnchorAt, timezone).hm,
            all_day: s.allDay,
            anchor: s.anchorType && s.anchorId
                ? { type: s.anchorType, id: s.anchorId }
                : null,
            offset_days: s.offsetDays,
            repeat: {
                type: s.repeat === 'NONE' ? 'NEVER' : s.repeat,
                interval: s.repeatInterval,
                end_date: s.repeatEndDate ? (0, schedule_math_1.allDayAnchorYmd)(s.repeatEndDate) : null,
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
};
exports.NotificationScheduleService = NotificationScheduleService;
exports.NotificationScheduleService = NotificationScheduleService = NotificationScheduleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(notification_clock_1.NOTIFICATION_CLOCK)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService,
        notification_scheduler_service_1.NotificationScheduler,
        source_resolver_registry_1.SourceResolverRegistry, Object, logger_service_1.LoggerService])
], NotificationScheduleService);
//# sourceMappingURL=notification-schedule.service.js.map