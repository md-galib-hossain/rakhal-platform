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
var NotificationScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationScheduler = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const metrics_service_1 = require("src/core/observability/metrics/metrics.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const audience_1 = require("../../domain/audience");
const schedule_math_1 = require("../../domain/schedule-math");
const notification_clock_1 = require("../queue/notification-clock");
const schedule_queue_port_1 = require("../queue/schedule-queue.port");
const source_resolver_registry_1 = require("../resolvers/source-resolver.registry");
const PAGE = 500;
const OCCURRENCE_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const SCHEDULE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PURGE_BATCH = 1000;
const MANUAL_DEFAULT_CATEGORY = 'operational';
const MANUAL_DEFAULT_PRIORITY = 'medium';
let NotificationScheduler = NotificationScheduler_1 = class NotificationScheduler {
    prisma;
    farmClock;
    registry;
    metrics;
    queue;
    clock;
    flag;
    log;
    constructor(prisma, farmClock, registry, metrics, queue, clock, flag, logger) {
        this.prisma = prisma;
        this.farmClock = farmClock;
        this.registry = registry;
        this.metrics = metrics;
        this.queue = queue;
        this.clock = clock;
        this.flag = flag;
        this.log = logger.setContext(NotificationScheduler_1.name);
    }
    get enabled() {
        return this.flag.enabled;
    }
    onApplicationBootstrap() {
        if (!this.flag.enabled)
            return;
        void this.reconcile().catch((err) => this.log.error('Boot reconcile failed', {
            error: err instanceof Error ? err.message : String(err),
        }));
    }
    async upsertForSource(input) {
        if (!this.flag.enabled)
            return null;
        const leads = (0, schedule_math_1.normalizeLeads)(input.leadMinutes);
        const leadError = (0, schedule_math_1.validateLeads)(leads, input.allDay);
        if (leadError)
            throw new common_1.BadRequestException(leadError);
        const now = this.clock.now();
        const timezone = await this.farmClock.timezone(input.farmId);
        const data = {
            category: input.category,
            priority: input.priority,
            eventKey: input.eventKey,
            baseAnchorAt: input.anchorAt,
            anchorAt: input.anchorAt,
            allDay: input.allDay,
            sendTime: input.sendTime ?? '08:00',
            leadMinutes: leads,
            status: 'ACTIVE',
            audienceUserIds: input.audienceHint?.userIds ?? [],
            audienceRoles: input.audienceHint?.roles ?? [...audience_1.DEFAULT_SOURCE_ROLES],
        };
        const where = {
            farmId: input.farmId,
            sourceType: input.sourceType,
            sourceKey: input.sourceKey,
        };
        let schedule = await this.prisma.notificationSchedule.findFirst({ where });
        if (schedule) {
            schedule = await this.prisma.notificationSchedule.update({
                where: { id: schedule.id },
                data,
            });
        }
        else {
            try {
                schedule = await this.prisma.notificationSchedule.create({
                    data: {
                        ...where,
                        ...data,
                        origin: 'SYSTEM',
                        trigger: 'SOURCE_DUE',
                        repeat: 'NONE',
                        audienceMode: 'SOURCE',
                    },
                });
            }
            catch (err) {
                if (!isUniqueViolation(err))
                    throw err;
                const winner = await this.prisma.notificationSchedule.findFirstOrThrow({
                    where,
                });
                schedule = await this.prisma.notificationSchedule.update({
                    where: { id: winner.id },
                    data,
                });
            }
        }
        const toEnqueue = await this.applyPlan(schedule, timezone, now, 'EDITED');
        return { scheduleId: schedule.id, toEnqueue };
    }
    async refreshSource(farmId, sourceType, sourceKeys) {
        if (!this.flag.enabled || sourceKeys.length === 0)
            return;
        const resolver = this.registry.get(sourceType);
        if (!resolver) {
            this.log.warn('refreshSource: no resolver registered', { sourceType });
            return;
        }
        const now = this.clock.now();
        const timezone = await this.farmClock.timezone(farmId);
        const schedules = await this.prisma.notificationSchedule.findMany({
            where: {
                farmId,
                sourceType,
                sourceKey: { in: sourceKeys },
                status: 'ACTIVE',
            },
        });
        for (const s of schedules) {
            const res = await resolver.resolve({
                farmId,
                sourceKey: s.sourceKey ?? '',
                timezone,
                now,
                leadMinutes: s.leadMinutes[0] ?? 0,
                anchorAt: s.anchorAt,
            });
            if (res.state === 'OK') {
                await this.prisma.notificationSchedule.update({
                    where: { id: s.id },
                    data: { audienceUserIds: res.userIds },
                });
            }
            else {
                await this.cancelPending(s.id, res.state === 'GONE' ? 'SOURCE_GONE' : 'ANIMALS_GONE');
                await this.prisma.notificationSchedule.update({
                    where: { id: s.id },
                    data: { status: 'CANCELLED' },
                });
            }
        }
    }
    async cancelForSource(farmId, sourceType, sourceKey) {
        if (!this.flag.enabled)
            return;
        const s = await this.prisma.notificationSchedule.findFirst({
            where: { farmId, sourceType, sourceKey },
        });
        if (!s)
            return;
        await this.cancelPending(s.id, 'SOURCE_GONE');
        await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: { status: 'CANCELLED' },
        });
    }
    async reanchor(anchorType, anchorId, newAnchorAt) {
        if (!this.flag.enabled)
            return [];
        const schedules = await this.prisma.notificationSchedule.findMany({
            where: {
                anchorType,
                anchorId,
                origin: 'USER',
                status: { in: ['ACTIVE', 'PAUSED'] },
            },
        });
        const now = this.clock.now();
        const toEnqueue = [];
        const tzCache = new Map();
        for (const s of schedules) {
            if (newAnchorAt === null) {
                await this.cancelPending(s.id, 'SOURCE_GONE');
                await this.prisma.notificationSchedule.update({
                    where: { id: s.id },
                    data: { status: 'CANCELLED' },
                });
                continue;
            }
            if (s.trigger !== 'BEFORE_EVENT' && s.trigger !== 'AFTER_EVENT')
                continue;
            const timezone = await this.tzFor(s.farmId, tzCache);
            const anchor = (0, schedule_math_1.anchorFromEntity)({
                trigger: s.trigger,
                entityAt: newAnchorAt,
                offsetDays: s.offsetDays ?? 0,
                allDay: s.allDay,
                timezone,
            });
            const moved = await this.prisma.notificationSchedule.update({
                where: { id: s.id },
                data: { baseAnchorAt: anchor, anchorAt: anchor, seriesIndex: 0 },
            });
            if (moved.status === 'ACTIVE') {
                toEnqueue.push(...(await this.applyPlan(moved, timezone, now, 'EDITED')));
            }
        }
        await this.enqueueAfterCommit(toEnqueue);
        return toEnqueue;
    }
    async createManual(farmId, userId, input) {
        const leads = (0, schedule_math_1.normalizeLeads)(input.leadMinutes);
        const leadError = (0, schedule_math_1.validateLeads)(leads, input.allDay);
        if (leadError)
            throw new common_1.BadRequestException(leadError);
        const timezone = await this.farmClock.timezone(farmId);
        const schedule = await this.prisma.notificationSchedule.create({
            data: {
                farmId,
                origin: 'USER',
                createdBy: userId,
                status: 'ACTIVE',
                title: input.title,
                body: input.body ?? null,
                category: input.category ?? MANUAL_DEFAULT_CATEGORY,
                priority: input.priority ?? MANUAL_DEFAULT_PRIORITY,
                eventKey: 'custom_reminder',
                trigger: input.trigger,
                baseAnchorAt: input.baseAnchorAt,
                anchorAt: input.baseAnchorAt,
                allDay: input.allDay,
                sendTime: input.sendTime ?? '08:00',
                leadMinutes: leads,
                offsetDays: input.offsetDays ?? null,
                repeat: input.repeat ?? 'NONE',
                repeatInterval: input.repeatInterval ?? null,
                repeatEndDate: input.repeatEndDate ?? null,
                audienceMode: input.audienceMode,
                audienceUserIds: input.audienceUserIds ?? [],
                audienceRoles: input.audienceRoles ?? [],
                animalIds: input.animalIds ?? [],
                anchorType: input.anchorType ?? null,
                anchorId: input.anchorId ?? null,
            },
        });
        const toEnqueue = await this.applyPlan(schedule, timezone, this.clock.now(), 'EDITED');
        if (toEnqueue.length === 0) {
            await this.prisma.notificationSchedule.delete({
                where: { id: schedule.id },
            });
            throw new common_1.UnprocessableEntityException('NO_FUTURE_OCCURRENCE');
        }
        await this.enqueueAfterCommit(toEnqueue);
        return this.prisma.notificationSchedule.findUniqueOrThrow({
            where: { id: schedule.id },
        });
    }
    async updateManual(farmId, scheduleId, patch) {
        const current = await this.getManual(farmId, scheduleId);
        if (patch.leadMinutes) {
            const leads = (0, schedule_math_1.normalizeLeads)(patch.leadMinutes);
            const err = (0, schedule_math_1.validateLeads)(leads, patch.allDay ?? current.allDay);
            if (err)
                throw new common_1.BadRequestException(err);
        }
        const data = {};
        if (patch.title !== undefined)
            data.title = patch.title;
        if (patch.body !== undefined)
            data.body = patch.body;
        if (patch.category !== undefined)
            data.category = patch.category;
        if (patch.priority !== undefined)
            data.priority = patch.priority;
        if (patch.trigger !== undefined)
            data.trigger = patch.trigger;
        if (patch.baseAnchorAt !== undefined) {
            data.baseAnchorAt = patch.baseAnchorAt;
            data.anchorAt = patch.baseAnchorAt;
            data.seriesIndex = 0;
        }
        if (patch.allDay !== undefined)
            data.allDay = patch.allDay;
        if (patch.sendTime !== undefined)
            data.sendTime = patch.sendTime;
        if (patch.leadMinutes !== undefined) {
            data.leadMinutes = (0, schedule_math_1.normalizeLeads)(patch.leadMinutes);
        }
        if (patch.offsetDays !== undefined)
            data.offsetDays = patch.offsetDays;
        if (patch.anchorType !== undefined)
            data.anchorType = patch.anchorType;
        if (patch.anchorId !== undefined)
            data.anchorId = patch.anchorId;
        if (patch.repeat !== undefined)
            data.repeat = patch.repeat;
        if (patch.repeatInterval !== undefined) {
            data.repeatInterval = patch.repeatInterval;
        }
        if (patch.repeatEndDate !== undefined) {
            data.repeatEndDate = patch.repeatEndDate;
        }
        if (patch.audienceMode !== undefined) {
            data.audienceMode = patch.audienceMode;
        }
        if (patch.audienceUserIds !== undefined) {
            data.audienceUserIds = patch.audienceUserIds;
        }
        if (patch.audienceRoles !== undefined) {
            data.audienceRoles = patch.audienceRoles;
        }
        if (patch.animalIds !== undefined)
            data.animalIds = patch.animalIds;
        const updated = await this.prisma.notificationSchedule.update({
            where: { id: current.id },
            data,
        });
        if (updated.status === 'ACTIVE') {
            const timezone = await this.farmClock.timezone(farmId);
            const toEnqueue = await this.applyPlan(updated, timezone, this.clock.now(), 'EDITED');
            await this.enqueueAfterCommit(toEnqueue);
        }
        return this.prisma.notificationSchedule.findUniqueOrThrow({
            where: { id: current.id },
        });
    }
    async pause(farmId, scheduleId) {
        const s = await this.getManual(farmId, scheduleId);
        await this.cancelPending(s.id, 'PAUSED');
        await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: { status: 'PAUSED' },
        });
    }
    async resume(farmId, scheduleId) {
        const s = await this.getManual(farmId, scheduleId);
        const timezone = await this.farmClock.timezone(farmId);
        const active = await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: { status: 'ACTIVE' },
        });
        const toEnqueue = await this.applyPlan(active, timezone, this.clock.now(), 'EDITED');
        await this.enqueueAfterCommit(toEnqueue);
    }
    async cancel(farmId, scheduleId) {
        const s = await this.getManual(farmId, scheduleId);
        await this.cancelPending(s.id, 'EDITED');
        await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: { status: 'CANCELLED' },
        });
    }
    async enqueueAfterCommit(occurrenceIds) {
        if (occurrenceIds.length === 0)
            return;
        const rows = await this.prisma.notificationOccurrence.findMany({
            where: { id: { in: occurrenceIds }, status: 'SCHEDULED' },
            select: { id: true, fireAt: true },
        });
        const now = this.clock.now();
        const horizon = now.getTime() + schedule_queue_port_1.ENQUEUE_HORIZON_MS;
        for (const row of rows) {
            if (row.fireAt.getTime() >= horizon)
                continue;
            await this.addJob(row.id, row.fireAt, now);
        }
    }
    async addJob(id, fireAt, now) {
        try {
            await this.queue.add(id, Math.max(0, fireAt.getTime() - now.getTime()));
            return true;
        }
        catch (err) {
            this.log.warn('Queue add failed; reconcile will retry', {
                occurrenceId: id,
                error: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }
    async advance(scheduleId) {
        const s = await this.prisma.notificationSchedule.findUnique({
            where: { id: scheduleId },
        });
        if (!s || s.status !== 'ACTIVE')
            return false;
        const pending = await this.prisma.notificationOccurrence.count({
            where: { scheduleId, status: 'SCHEDULED' },
        });
        if (pending > 0)
            return false;
        const now = this.clock.now();
        const timezone = await this.farmClock.timezone(s.farmId);
        const next = (0, schedule_math_1.advanceSeries)(this.seriesOf(s, timezone), s.seriesIndex, now);
        if (!next) {
            await this.prisma.notificationSchedule.update({
                where: { id: s.id },
                data: { status: 'DONE' },
            });
            return true;
        }
        await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: { anchorAt: next.anchorAt, seriesIndex: next.seriesIndex },
        });
        const ids = [];
        for (const p of next.occurrences) {
            ids.push(await this.ensureOccurrence(s, p));
        }
        await this.enqueueAfterCommit(ids);
        return true;
    }
    async reconcile(now = this.clock.now(), opts = {}) {
        const result = { enqueued: 0, removed: 0, advanced: 0, purged: 0 };
        const jobIds = new Set(await this.queue.liveJobIds());
        const horizon = new Date(now.getTime() + schedule_queue_port_1.ENQUEUE_HORIZON_MS);
        let cursor;
        for (;;) {
            const rows = await this.prisma.notificationOccurrence.findMany({
                where: { status: 'SCHEDULED', fireAt: { lt: horizon } },
                orderBy: { id: 'asc' },
                take: PAGE,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                select: { id: true, fireAt: true },
            });
            for (const row of rows) {
                if (jobIds.has(row.id))
                    continue;
                if (await this.addJob(row.id, row.fireAt, now)) {
                    jobIds.add(row.id);
                    result.enqueued++;
                }
            }
            if (rows.length < PAGE)
                break;
            cursor = rows[rows.length - 1].id;
        }
        if (jobIds.size > 0) {
            const all = [...jobIds];
            const scheduled = new Set();
            for (let i = 0; i < all.length; i += PURGE_BATCH) {
                const rows = await this.prisma.notificationOccurrence.findMany({
                    where: {
                        id: { in: all.slice(i, i + PURGE_BATCH) },
                        status: 'SCHEDULED',
                    },
                    select: { id: true },
                });
                for (const r of rows)
                    scheduled.add(r.id);
            }
            for (const id of all) {
                if (scheduled.has(id))
                    continue;
                await this.queue.remove(id);
                jobIds.delete(id);
                result.removed++;
            }
        }
        for (;;) {
            const stalled = await this.prisma.notificationSchedule.findMany({
                where: {
                    status: 'ACTIVE',
                    occurrences: { none: { status: 'SCHEDULED' } },
                },
                select: { id: true },
                take: PAGE,
            });
            let progressed = 0;
            for (const s of stalled) {
                if (await this.advance(s.id))
                    progressed++;
            }
            result.advanced += progressed;
            if (stalled.length < PAGE || progressed === 0)
                break;
        }
        if (opts.purge)
            result.purged = await this.purge(now);
        this.metrics.recordNotificationReconcile('enqueued', result.enqueued);
        this.metrics.recordNotificationReconcile('removed', result.removed);
        this.metrics.recordNotificationReconcile('advanced', result.advanced);
        this.metrics.recordNotificationReconcile('purged', result.purged);
        this.metrics.setNotificationQueueDelayed(jobIds.size);
        if (result.enqueued > 0 || result.removed > 0 || result.advanced > 0) {
            this.log.info('Notification reconcile repaired drift', result);
        }
        return result;
    }
    async purge(now) {
        let purged = 0;
        const occCutoff = new Date(now.getTime() - OCCURRENCE_RETENTION_MS);
        for (;;) {
            const rows = await this.prisma.notificationOccurrence.findMany({
                where: {
                    status: { in: ['FIRED', 'SKIPPED', 'CANCELLED'] },
                    fireAt: { lt: occCutoff },
                },
                select: { id: true },
                take: PURGE_BATCH,
            });
            if (rows.length === 0)
                break;
            const { count } = await this.prisma.notificationOccurrence.deleteMany({
                where: { id: { in: rows.map((r) => r.id) } },
            });
            purged += count;
            if (rows.length < PURGE_BATCH)
                break;
        }
        const schCutoff = new Date(now.getTime() - SCHEDULE_RETENTION_MS);
        for (;;) {
            const rows = await this.prisma.notificationSchedule.findMany({
                where: {
                    status: { in: ['DONE', 'CANCELLED'] },
                    updatedAt: { lt: schCutoff },
                    occurrences: { none: {} },
                },
                select: { id: true },
                take: PURGE_BATCH,
            });
            if (rows.length === 0)
                break;
            const { count } = await this.prisma.notificationSchedule.deleteMany({
                where: { id: { in: rows.map((r) => r.id) } },
            });
            purged += count;
            if (rows.length < PURGE_BATCH)
                break;
        }
        return purged;
    }
    seriesOf(s, timezone) {
        return {
            baseAnchorAt: s.baseAnchorAt,
            allDay: s.allDay,
            repeat: s.repeat,
            repeatInterval: s.repeatInterval,
            repeatEndDate: s.repeatEndDate,
            timezone,
            sendTime: s.sendTime,
            leadMinutes: s.leadMinutes,
        };
    }
    async applyPlan(s, timezone, now, cancelReason) {
        const start = (0, schedule_math_1.firstLiveAnchor)(this.seriesOf(s, timezone), 0, now);
        const planned = start?.occurrences ?? [];
        const keyOf = (anchor, lead) => `${anchor.getTime()}:${lead}`;
        const plannedKeys = new Set(planned.map((p) => keyOf(p.anchorAt, p.leadMinutes)));
        const existing = await this.prisma.notificationOccurrence.findMany({
            where: { scheduleId: s.id },
        });
        const byKey = new Map(existing.map((o) => [keyOf(o.anchorAt, o.leadMinutes), o]));
        const stale = existing.filter((o) => o.status === 'SCHEDULED' &&
            !plannedKeys.has(keyOf(o.anchorAt, o.leadMinutes)));
        if (stale.length > 0) {
            await this.cancelOccurrences(stale.map((o) => o.id), cancelReason);
        }
        const toEnqueue = [];
        for (const p of planned) {
            const ex = byKey.get(keyOf(p.anchorAt, p.leadMinutes));
            if (!ex) {
                toEnqueue.push(await this.ensureOccurrence(s, p));
                continue;
            }
            if (ex.status === 'FIRED' || ex.status === 'SKIPPED')
                continue;
            const fireAt = (0, schedule_math_1.applyJitter)(p.fireAt, ex.id, s.origin);
            if (ex.status === 'SCHEDULED' &&
                ex.fireAt.getTime() === fireAt.getTime()) {
                continue;
            }
            if (ex.status === 'SCHEDULED')
                await this.safeRemove(ex.id);
            await this.prisma.notificationOccurrence.update({
                where: { id: ex.id },
                data: { status: 'SCHEDULED', fireAt, reason: null },
            });
            toEnqueue.push(ex.id);
        }
        await this.prisma.notificationSchedule.update({
            where: { id: s.id },
            data: {
                status: start || s.status === 'PAUSED' ? s.status : 'DONE',
                anchorAt: start?.anchorAt ?? s.anchorAt,
                seriesIndex: start?.seriesIndex ?? s.seriesIndex,
            },
        });
        return toEnqueue;
    }
    async ensureOccurrence(s, p) {
        const id = (0, crypto_1.randomUUID)();
        const row = await this.prisma.notificationOccurrence.upsert({
            where: {
                scheduleId_anchorAt_leadMinutes: {
                    scheduleId: s.id,
                    anchorAt: p.anchorAt,
                    leadMinutes: p.leadMinutes,
                },
            },
            create: {
                id,
                scheduleId: s.id,
                farmId: s.farmId,
                anchorAt: p.anchorAt,
                leadMinutes: p.leadMinutes,
                fireAt: (0, schedule_math_1.applyJitter)(p.fireAt, id, s.origin),
            },
            update: {},
        });
        return row.id;
    }
    async cancelPending(scheduleId, reason) {
        const rows = await this.prisma.notificationOccurrence.findMany({
            where: { scheduleId, status: 'SCHEDULED' },
            select: { id: true },
        });
        await this.cancelOccurrences(rows.map((r) => r.id), reason);
    }
    async cancelOccurrences(ids, reason) {
        if (ids.length === 0)
            return;
        const { count } = await this.prisma.notificationOccurrence.updateMany({
            where: { id: { in: ids }, status: 'SCHEDULED' },
            data: { status: 'CANCELLED', reason },
        });
        for (const id of ids)
            await this.safeRemove(id);
        for (let i = 0; i < count; i++) {
            this.metrics.recordNotificationOccurrence('cancelled', reason);
        }
    }
    async safeRemove(id) {
        try {
            await this.queue.remove(id);
        }
        catch (err) {
            this.log.warn('Queue remove failed; reconcile will clean up', {
                occurrenceId: id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async getManual(farmId, scheduleId) {
        const s = await this.prisma.notificationSchedule.findFirst({
            where: { id: scheduleId, farmId },
        });
        if (!s)
            throw new common_1.NotFoundException('Schedule not found');
        if (s.origin !== 'USER') {
            throw new common_1.ConflictException('System schedules are read-only');
        }
        return s;
    }
    async tzFor(farmId, cache) {
        let tz = cache.get(farmId);
        if (!tz) {
            tz = await this.farmClock.timezone(farmId);
            cache.set(farmId, tz);
        }
        return tz;
    }
};
exports.NotificationScheduler = NotificationScheduler;
exports.NotificationScheduler = NotificationScheduler = NotificationScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(schedule_queue_port_1.SCHEDULE_QUEUE_PORT)),
    __param(5, (0, common_1.Inject)(notification_clock_1.NOTIFICATION_CLOCK)),
    __param(6, (0, common_1.Inject)(notification_clock_1.NV2_FLAG)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService,
        source_resolver_registry_1.SourceResolverRegistry,
        metrics_service_1.MetricsService, Object, Object, Object, logger_service_1.LoggerService])
], NotificationScheduler);
function isUniqueViolation(err) {
    return (typeof err === 'object' &&
        err !== null &&
        err.code === 'P2002');
}
//# sourceMappingURL=notification-scheduler.service.js.map