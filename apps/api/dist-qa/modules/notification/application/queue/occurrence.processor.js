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
var OccurrenceProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OccurrenceWorker = exports.OccurrenceProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const metrics_service_1 = require("src/core/observability/metrics/metrics.service");
const audience_1 = require("../../domain/audience");
const late_rule_1 = require("../../domain/late-rule");
const schedule_math_1 = require("../../domain/schedule-math");
const source_resolver_registry_1 = require("../resolvers/source-resolver.registry");
const notification_scheduler_service_1 = require("../services/notification-scheduler.service");
const notification_service_1 = require("../services/notification.service");
const notification_clock_1 = require("./notification-clock");
const schedule_queue_port_1 = require("./schedule-queue.port");
let OccurrenceProcessor = OccurrenceProcessor_1 = class OccurrenceProcessor {
    prisma;
    farmClock;
    registry;
    notifications;
    scheduler;
    metrics;
    clock;
    log;
    constructor(prisma, farmClock, registry, notifications, scheduler, metrics, clock, logger) {
        this.prisma = prisma;
        this.farmClock = farmClock;
        this.registry = registry;
        this.notifications = notifications;
        this.scheduler = scheduler;
        this.metrics = metrics;
        this.clock = clock;
        this.log = logger.setContext(OccurrenceProcessor_1.name);
    }
    async process(occurrenceId) {
        const now = this.clock.now();
        const occ = await this.prisma.notificationOccurrence.findUnique({
            where: { id: occurrenceId },
            include: { schedule: true },
        });
        if (!occ || occ.status !== 'SCHEDULED')
            return { outcome: 'ignored' };
        const s = occ.schedule;
        if (s.status !== 'ACTIVE') {
            return this.finishCancelled(occ.id, s.id, s.status === 'PAUSED' ? 'PAUSED' : 'EDITED');
        }
        if ((0, late_rule_1.evaluateLate)(occ.fireAt, now) === 'LATE') {
            return this.finishSkipped(occ.id, s.id, 'LATE');
        }
        const timezone = await this.farmClock.timezone(s.farmId);
        let sourceUserIds = [];
        let sourceRoles = [];
        let params = {
            title: s.title ?? '',
            body: s.body ?? '',
        };
        let title = s.title ?? '';
        let message = s.body ?? '';
        let link;
        let data = {
            scheduleId: s.id,
            occurrenceId: occ.id,
        };
        if (s.origin === 'SYSTEM') {
            const resolver = s.sourceType
                ? this.registry.get(s.sourceType)
                : undefined;
            if (!resolver || !s.sourceKey) {
                throw new Error(`No source resolver registered for ${String(s.sourceType)}`);
            }
            const res = await resolver.resolve({
                farmId: s.farmId,
                sourceKey: s.sourceKey,
                timezone,
                now,
                leadMinutes: occ.leadMinutes,
                anchorAt: occ.anchorAt,
            });
            if (res.state === 'GONE') {
                return this.finishCancelled(occ.id, s.id, 'SOURCE_GONE');
            }
            if (res.state === 'ANIMALS_GONE') {
                return this.finishCancelled(occ.id, s.id, 'ANIMALS_GONE');
            }
            sourceUserIds = res.userIds;
            sourceRoles = res.roles ?? [];
            params = res.params;
            title = res.title;
            message = res.message;
            link = res.link;
            data = { ...data, ...(res.data ?? {}) };
        }
        else {
            if (s.anchorType && s.anchorId) {
                const checker = this.registry.getAnchorChecker(s.anchorType);
                if (checker && !(await checker.exists(s.farmId, s.anchorId))) {
                    return this.finishCancelled(occ.id, s.id, 'SOURCE_GONE');
                }
            }
            if (s.animalIds.length > 0) {
                const alive = await this.prisma.cattle.count({
                    where: {
                        id: { in: s.animalIds },
                        farmId: s.farmId,
                        herdStatus: 'ACTIVE',
                        deletedAt: null,
                    },
                });
                if (alive === 0) {
                    return this.finishCancelled(occ.id, s.id, 'ANIMALS_GONE');
                }
                if (s.animalIds.length === 1)
                    link = `/animals?view=${s.animalIds[0]}`;
                data = { ...data, animalIds: s.animalIds };
            }
        }
        const members = await this.loadMembers(s.farmId);
        const recipients = (0, audience_1.resolveAudience)({
            mode: s.audienceMode,
            userIds: s.audienceUserIds,
            roles: s.origin === 'SYSTEM' ? sourceRoles : s.audienceRoles,
            sourceUserIds,
        }, members);
        if (recipients.length === 0) {
            return this.finishSkipped(occ.id, s.id, 'NO_RECIPIENTS');
        }
        await this.notifications.notifyUsers({
            farmId: s.farmId,
            userIds: recipients,
            eventKey: (0, schedule_math_1.eventKeyForBand)(s.origin, occ.leadMinutes),
            title,
            message,
            params,
            link,
            data,
            dedupeKey: `occurrence:${occ.id}`,
        });
        const fired = await this.prisma.notificationOccurrence.updateMany({
            where: { id: occ.id, status: 'SCHEDULED' },
            data: {
                status: 'FIRED',
                firedAt: now,
                recipientCount: recipients.length,
            },
        });
        if (fired.count > 0) {
            this.metrics.recordNotificationOccurrence('fired');
            this.metrics.observeNotificationFireLag((now.getTime() - occ.fireAt.getTime()) / 1000);
        }
        this.log.info('Occurrence fired', {
            occurrenceId: occ.id,
            scheduleId: s.id,
            farmId: s.farmId,
            recipients: recipients.length,
        });
        await this.scheduler.advance(s.id);
        return { outcome: 'fired', recipientCount: recipients.length };
    }
    async finishSkipped(occurrenceId, scheduleId, reason) {
        await this.mark(occurrenceId, 'SKIPPED', reason);
        await this.scheduler.advance(scheduleId);
        return { outcome: 'skipped', reason };
    }
    async finishCancelled(occurrenceId, scheduleId, reason) {
        await this.mark(occurrenceId, 'CANCELLED', reason);
        await this.scheduler.advance(scheduleId);
        return { outcome: 'cancelled', reason };
    }
    async mark(occurrenceId, status, reason) {
        const { count } = await this.prisma.notificationOccurrence.updateMany({
            where: { id: occurrenceId, status: 'SCHEDULED' },
            data: { status, reason },
        });
        if (count > 0) {
            this.metrics.recordNotificationOccurrence(status === 'SKIPPED' ? 'skipped' : 'cancelled', reason);
        }
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
};
exports.OccurrenceProcessor = OccurrenceProcessor;
exports.OccurrenceProcessor = OccurrenceProcessor = OccurrenceProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)(notification_clock_1.NOTIFICATION_CLOCK)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        farm_clock_service_1.FarmClockService,
        source_resolver_registry_1.SourceResolverRegistry,
        notification_service_1.NotificationService,
        notification_scheduler_service_1.NotificationScheduler,
        metrics_service_1.MetricsService, Object, logger_service_1.LoggerService])
], OccurrenceProcessor);
let OccurrenceWorker = class OccurrenceWorker extends bullmq_1.WorkerHost {
    processor;
    constructor(processor) {
        super();
        this.processor = processor;
    }
    async process(job) {
        if (job.name !== schedule_queue_port_1.NOTIFICATION_FIRE_JOB)
            return;
        await this.processor.process(job.data.occurrenceId);
    }
};
exports.OccurrenceWorker = OccurrenceWorker;
exports.OccurrenceWorker = OccurrenceWorker = __decorate([
    (0, bullmq_1.Processor)(schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE, {
        concurrency: 8,
        limiter: { max: 50, duration: 1000 },
    }),
    __metadata("design:paramtypes", [OccurrenceProcessor])
], OccurrenceWorker);
//# sourceMappingURL=occurrence.processor.js.map