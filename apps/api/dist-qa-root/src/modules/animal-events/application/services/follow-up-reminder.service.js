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
var FollowUpReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpReminderService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const follow_up_rules_1 = require("../../domain/follow-up-rules");
const reminder_cadence_1 = require("../../domain/reminder-cadence");
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const DEFAULT_ROLES = ['Owner', 'Manager'];
const MAX_LEAD_DAYS = 90;
const TASK_SELECT = {
    id: true,
    farmId: true,
    name: true,
    category: true,
    kind: true,
    ruleKey: true,
    sourceEventId: true,
    dueAt: true,
    remindDaysBefore: true,
    notifyRoleNames: true,
    assignedToId: true,
    relatedCattleId: true,
    recurring: true,
    spawnedNextAt: true,
    cattles: { select: { cattleId: true } },
    recipients: { select: { userId: true } },
};
let FollowUpReminderService = FollowUpReminderService_1 = class FollowUpReminderService {
    prisma;
    notifications;
    clock;
    tasks;
    log;
    constructor(prisma, notifications, clock, tasks, logger) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.clock = clock;
        this.tasks = tasks;
        this.log = logger.setContext(FollowUpReminderService_1.name);
    }
    async sweepAll(now = new Date()) {
        const rows = await this.prisma.task.findMany({
            where: {
                status: { in: [...OPEN] },
                OR: [{ ruleKey: { not: null } }, { kind: client_1.TaskKind.REMINDER }],
                dueAt: {
                    gte: new Date(now.getTime() - (reminder_cadence_1.REMINDER_OVERDUE_MAX_DAYS + 2) * DAY_MS),
                    lt: new Date(now.getTime() + (MAX_LEAD_DAYS + 2) * DAY_MS),
                },
            },
            select: TASK_SELECT,
        });
        const byFarm = new Map();
        for (const r of rows) {
            byFarm.set(r.farmId, [...(byFarm.get(r.farmId) ?? []), r]);
        }
        let sent = 0;
        for (const [farmId, farmRows] of byFarm) {
            try {
                sent += await this.sweepFarm(farmId, farmRows, now);
            }
            catch (err) {
                this.log.error('Follow-up reminder sweep failed for a farm', {
                    farmId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return sent;
    }
    daysUntil(due, timezone, now) {
        const dueDay = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, due)).getTime();
        const today = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, now)).getTime();
        return Math.round((dueDay - today) / DAY_MS);
    }
    async sweepFarm(farmId, rows, now) {
        const timezone = await this.clock.timezone(farmId);
        const allCattleIds = [...new Set(rows.flatMap((r) => this.cattleIdsOf(r)))];
        const cattle = allCattleIds.length
            ? await this.prisma.cattle.findMany({
                where: {
                    id: { in: allCattleIds },
                    farmId,
                    herdStatus: 'ACTIVE',
                    deletedAt: null,
                },
                select: { id: true, tagNumber: true, name: true },
            })
            : [];
        const cattleById = new Map(cattle.map((c) => [c.id, c]));
        const members = await this.prisma.farmMember.findMany({
            where: { farmId },
            select: { userId: true, role: { select: { name: true } } },
        });
        const buckets = new Map();
        for (const row of rows) {
            const daysUntil = this.daysUntil(row.dueAt, timezone, now);
            const isReminder = row.kind === client_1.TaskKind.REMINDER;
            if (isReminder && row.recurring && !row.spawnedNextAt && daysUntil <= 0) {
                await this.tasks.spawnNextReminder(row.id);
            }
            const decision = (0, reminder_cadence_1.decideReminder)(daysUntil, isReminder ? row.remindDaysBefore : reminder_cadence_1.FOLLOW_UP_LEAD_DAYS);
            if (!decision)
                continue;
            const ids = this.cattleIdsOf(row);
            const live = ids.filter((id) => cattleById.has(id));
            if (ids.length > 0 && live.length === 0)
                continue;
            const groupKey = isReminder ? `task:${row.id}` : `rule:${row.ruleKey}`;
            const dueYmd = (0, farm_time_1.localDateIso)(timezone, row.dueAt);
            const bucketKey = decision.stage === 'OVERDUE'
                ? `${groupKey}|OVERDUE`
                : `${groupKey}|${decision.stage}|${dueYmd}`;
            const recipients = this.recipientsOf(row, members);
            const existing = buckets.get(bucketKey);
            if (existing) {
                existing.taskIds.add(row.id);
                live.forEach((id) => existing.cattleIds.add(id));
                recipients.forEach((u) => existing.userIds.add(u));
                if (dueYmd < existing.dueYmd)
                    existing.dueYmd = dueYmd;
                if (decision.stage === 'OVERDUE') {
                    existing.daysUntil = Math.min(existing.daysUntil, daysUntil);
                }
                continue;
            }
            buckets.set(bucketKey, {
                stage: decision.stage,
                groupKey,
                label: isReminder
                    ? row.name
                    : ((0, follow_up_rules_1.ruleByKey)(row.ruleKey ?? '')?.title ?? row.name),
                ruleKey: row.ruleKey,
                isReminder,
                taskIds: new Set([row.id]),
                sourceEventId: row.sourceEventId,
                dueYmd,
                daysUntil,
                cattleIds: new Set(live),
                userIds: new Set(recipients),
            });
        }
        const todayYmd = (0, farm_time_1.localDateIso)(timezone, now);
        let sent = 0;
        for (const bucket of buckets.values()) {
            sent += await this.notify(farmId, bucket, todayYmd, cattleById);
        }
        return sent;
    }
    cattleIdsOf(row) {
        return [
            ...new Set([
                ...(row.relatedCattleId ? [row.relatedCattleId] : []),
                ...row.cattles.map((c) => c.cattleId),
            ]),
        ];
    }
    recipientsOf(row, members) {
        const explicit = new Set([
            ...(row.assignedToId ? [row.assignedToId] : []),
            ...row.recipients.map((r) => r.userId),
        ]);
        const roles = row.notifyRoleNames.length > 0
            ? row.notifyRoleNames
            : explicit.size === 0
                ? DEFAULT_ROLES
                : [];
        for (const m of members) {
            if (roles.includes(m.role.name))
                explicit.add(m.userId);
        }
        return [...explicit];
    }
    action(bucket) {
        const taskIds = [...bucket.taskIds];
        const cattleIds = [...bucket.cattleIds];
        const single = taskIds.length === 1 && cattleIds.length === 1;
        if (single) {
            const cattleId = cattleIds[0];
            const taskId = taskIds[0];
            const eventType = bucket.isReminder
                ? null
                : ((0, follow_up_rules_1.ruleByKey)(bucket.ruleKey ?? '')?.completesOn[0] ?? null);
            const q = new URLSearchParams({ view: cattleId });
            if (eventType)
                q.set('record', eventType);
            q.set('reminder', taskId);
            return {
                link: `/animals?${q.toString()}`,
                data: {
                    cattleId,
                    taskId,
                    ruleKey: bucket.ruleKey,
                    eventType,
                    sourceEventId: bucket.sourceEventId,
                },
            };
        }
        const data = {
            ruleKey: bucket.ruleKey,
            taskIds,
            count: bucket.isReminder ? cattleIds.length : taskIds.length,
        };
        if (bucket.isReminder) {
            return cattleIds.length === 0
                ? { data }
                : { link: `/animals?due=REMINDER&reminder=${taskIds[0]}`, data };
        }
        return { link: `/animals?due=${bucket.ruleKey}`, data };
    }
    animalsText(bucket, cattleById) {
        const tags = [...bucket.cattleIds].map((id) => cattleById.get(id)?.tagNumber ?? id);
        if (tags.length === 0)
            return 'farm-wide';
        if (tags.length <= 3)
            return tags.join(', ');
        return `${tags.slice(0, 3).join(', ')} +${tags.length - 3} more`;
    }
    async notify(farmId, bucket, todayYmd, cattleById) {
        if (bucket.userIds.size === 0)
            return 0;
        const animals = this.animalsText(bucket, cattleById);
        const days = bucket.stage === 'OVERDUE' ? -bucket.daysUntil : bucket.daysUntil;
        const title = bucket.stage === 'UPCOMING'
            ? `Coming up in ${days} day(s): ${bucket.label}`
            : bucket.stage === 'DUE_TODAY'
                ? `Due today: ${bucket.label}`
                : `Overdue: ${bucket.label}`;
        const created = await this.notifications.notifyUsers({
            farmId,
            userIds: [...bucket.userIds],
            eventKey: reminder_cadence_1.STAGE_EVENT_KEY[bucket.stage],
            title,
            message: `${bucket.label}: ${animals}, ${bucket.stage === 'OVERDUE' ? 'overdue since' : 'due'} ${bucket.dueYmd}.`,
            params: { label: bucket.label, animals, date: bucket.dueYmd, days },
            ...this.action(bucket),
            dedupeKey: bucket.stage === 'OVERDUE'
                ? `fu:${bucket.groupKey}:OVERDUE:${todayYmd}`
                : `fu:${bucket.groupKey}:${bucket.stage}:${bucket.dueYmd}`,
        });
        return created.length;
    }
};
exports.FollowUpReminderService = FollowUpReminderService;
exports.FollowUpReminderService = FollowUpReminderService = FollowUpReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        farm_clock_service_1.FarmClockService,
        task_service_1.TaskService,
        logger_service_1.LoggerService])
], FollowUpReminderService);
//# sourceMappingURL=follow-up-reminder.service.js.map