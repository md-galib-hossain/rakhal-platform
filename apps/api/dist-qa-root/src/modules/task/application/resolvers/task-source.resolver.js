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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskSourceResolver = exports.ruleTaskKey = exports.plainTaskKey = void 0;
exports.parseTaskSourceKey = parseTaskSourceKey;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const follow_up_rules_1 = require("src/modules/animal-events/domain/follow-up-rules");
const audience_1 = require("src/modules/notification/domain/audience");
const source_resolver_registry_1 = require("src/modules/notification/application/resolvers/source-resolver.registry");
const DAY_MS = 86_400_000;
const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
const plainTaskKey = (taskId) => `id:${taskId}`;
exports.plainTaskKey = plainTaskKey;
const ruleTaskKey = (ruleKey, ymd) => `rule:${ruleKey}:${ymd}`;
exports.ruleTaskKey = ruleTaskKey;
function parseTaskSourceKey(key) {
    if (key.startsWith('id:') && key.length > 3) {
        return { kind: 'id', taskId: key.slice(3) };
    }
    const m = /^rule:(.+):(\d{4}-\d{2}-\d{2})$/.exec(key);
    return m ? { kind: 'rule', ruleKey: m[1], ymd: m[2] } : null;
}
let TaskSourceResolver = class TaskSourceResolver {
    prisma;
    registry;
    sourceType = 'TASK';
    constructor(prisma, registry) {
        this.prisma = prisma;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
    }
    async resolve(ctx) {
        const key = parseTaskSourceKey(ctx.sourceKey);
        if (!key)
            return { state: 'GONE' };
        const rows = await this.openRows(ctx.farmId, key, ctx.timezone);
        if (rows.length === 0)
            return { state: 'GONE' };
        const allCattleIds = [...new Set(rows.flatMap((r) => this.cattleIdsOf(r)))];
        const live = allCattleIds.length
            ? await this.prisma.cattle.findMany({
                where: {
                    id: { in: allCattleIds },
                    farmId: ctx.farmId,
                    herdStatus: 'ACTIVE',
                    deletedAt: null,
                },
                select: { id: true, tagNumber: true },
            })
            : [];
        if (allCattleIds.length > 0 && live.length === 0) {
            return { state: 'ANIMALS_GONE' };
        }
        const liveIds = new Set(live.map((c) => c.id));
        const liveRows = rows.filter((r) => {
            const ids = this.cattleIdsOf(r);
            return ids.length === 0 || ids.some((id) => liveIds.has(id));
        });
        if (liveRows.length === 0)
            return { state: 'ANIMALS_GONE' };
        const first = [...liveRows].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
        const dueYmd = (0, farm_time_1.localDateIso)(ctx.timezone, first.dueAt);
        const days = Math.max(0, Math.round(((0, farm_time_1.dayKey)(dueYmd).getTime() -
            (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(ctx.timezone, ctx.now)).getTime()) /
            DAY_MS));
        const label = key.kind === 'rule'
            ? ((0, follow_up_rules_1.ruleByKey)(key.ruleKey)?.title ?? first.name)
            : first.name;
        const animals = animalsText(live.map((c) => c.tagNumber));
        const userIds = [
            ...new Set(liveRows.flatMap((r) => (r.assignedToId ? [r.assignedToId] : []))),
        ];
        const title = ctx.leadMinutes > 0
            ? `Coming up in ${days} day(s): ${label}`
            : `Due today: ${label}`;
        return {
            state: 'OK',
            userIds,
            roles: key.kind === 'rule' ? [...audience_1.DEFAULT_SOURCE_ROLES] : undefined,
            params: { label, animals, date: dueYmd, days },
            title,
            message: `${label}: ${animals}, due ${dueYmd}.`,
            ...this.action(key, liveRows, [...liveIds]),
        };
    }
    async openRows(farmId, key, timezone) {
        const select = {
            id: true,
            name: true,
            ruleKey: true,
            dueAt: true,
            assignedToId: true,
            relatedCattleId: true,
            sourceEventId: true,
            cattles: { select: { cattleId: true } },
        };
        if (key.kind === 'id') {
            return this.prisma.task.findMany({
                where: {
                    id: key.taskId,
                    farmId,
                    kind: client_1.TaskKind.TASK,
                    status: { in: [...OPEN_STATUSES] },
                },
                select,
            });
        }
        const day = (0, farm_time_1.dayKey)(key.ymd).getTime();
        const rows = await this.prisma.task.findMany({
            where: {
                farmId,
                ruleKey: key.ruleKey,
                kind: client_1.TaskKind.TASK,
                status: { in: [...OPEN_STATUSES] },
                dueAt: {
                    gte: new Date(day - 2 * DAY_MS),
                    lt: new Date(day + 3 * DAY_MS),
                },
            },
            select,
        });
        return rows.filter((r) => (0, farm_time_1.localDateIso)(timezone, r.dueAt) === key.ymd);
    }
    cattleIdsOf(row) {
        return [
            ...new Set([
                ...(row.relatedCattleId ? [row.relatedCattleId] : []),
                ...row.cattles.map((c) => c.cattleId),
            ]),
        ];
    }
    action(key, rows, cattleIds) {
        const taskIds = rows.map((r) => r.id);
        const ruleKey = key.kind === 'rule' ? key.ruleKey : (rows[0].ruleKey ?? null);
        if (taskIds.length === 1 && cattleIds.length === 1) {
            const cattleId = cattleIds[0];
            const taskId = taskIds[0];
            const eventType = ruleKey
                ? ((0, follow_up_rules_1.ruleByKey)(ruleKey)?.completesOn[0] ?? null)
                : null;
            const q = new URLSearchParams({ view: cattleId });
            if (eventType)
                q.set('record', eventType);
            q.set('reminder', taskId);
            return {
                link: `/animals?${q.toString()}`,
                data: {
                    cattleId,
                    taskId,
                    ruleKey,
                    eventType,
                    sourceEventId: rows[0].sourceEventId,
                },
            };
        }
        const data = { ruleKey, taskIds, count: taskIds.length };
        return ruleKey ? { link: `/animals?due=${ruleKey}`, data } : { data };
    }
};
exports.TaskSourceResolver = TaskSourceResolver;
exports.TaskSourceResolver = TaskSourceResolver = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        source_resolver_registry_1.SourceResolverRegistry])
], TaskSourceResolver);
function animalsText(tags) {
    if (tags.length === 0)
        return 'farm-wide';
    if (tags.length <= 3)
        return tags.join(', ');
    return `${tags.slice(0, 3).join(', ')} +${tags.length - 3} more`;
}
//# sourceMappingURL=task-source.resolver.js.map