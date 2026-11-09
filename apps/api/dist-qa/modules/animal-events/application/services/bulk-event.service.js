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
var BulkEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkEventService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const event_registry_1 = require("../../domain/event-registry");
const parse_payload_1 = require("../parse-payload");
const animal_event_types_service_1 = require("./animal-event-types.service");
const task_notification_producer_1 = require("src/modules/task/application/resolvers/task-notification.producer");
const animal_event_write_service_1 = require("./animal-event-write.service");
const PER_ANIMAL_TYPES = new Set(['WEIGHT', 'BCS', 'PREG_CHECK']);
let BulkEventService = BulkEventService_1 = class BulkEventService {
    prisma;
    writer;
    activity;
    notifications;
    taskNotifier;
    registry;
    log;
    constructor(prisma, writer, activity, notifications, taskNotifier, registry, logger) {
        this.prisma = prisma;
        this.writer = writer;
        this.activity = activity;
        this.notifications = notifications;
        this.taskNotifier = taskNotifier;
        this.registry = registry;
        this.log = logger.setContext(BulkEventService_1.name);
    }
    async bulk(farmId, userId, dto, opts = {}) {
        if (!this.registry.get(dto.type)) {
            throw (0, parse_payload_1.eventError)('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
        }
        const mode = dto.mode ?? 'skipIneligible';
        const requested = [...dto.cattleIds];
        const ids = [...new Set(requested)].sort();
        if (dto.values) {
            if (!PER_ANIMAL_TYPES.has(dto.type)) {
                throw (0, parse_payload_1.eventError)('BULK_VALUES_NOT_SUPPORTED', `Per-animal values are only for ${[...PER_ANIMAL_TYPES].join(', ')}`);
            }
            const stray = Object.keys(dto.values).filter((k) => !ids.includes(k));
            if (stray.length) {
                throw new common_1.BadRequestException(`values has entries for animals not in cattleIds: ${stray.join(', ')}`);
            }
        }
        const cows = await this.prisma.cattle.findMany({
            where: { id: { in: ids }, farmId },
            select: { id: true, tagNumber: true },
        });
        if (cows.length !== ids.length) {
            const have = new Set(cows.map((c) => c.id));
            throw new common_1.NotFoundException({
                message: 'One or more animals were not found',
                details: { missing: ids.filter((i) => !have.has(i)) },
            });
        }
        const tagOf = new Map(cows.map((c) => [c.id, c.tagNumber]));
        const recordDto = (id) => ({
            type: dto.type,
            eventAt: dto.eventAt,
            provenance: dto.provenance,
            notes: dto.notes,
            customTypeId: dto.customTypeId,
            followUps: dto.followUps,
            payload: { ...(dto.payload ?? {}), ...(dto.values?.[id] ?? {}) },
        });
        const rows = new Map();
        const eligible = [];
        for (const id of ids) {
            const base = { cattleId: id, tagNumber: tagOf.get(id) };
            if (PER_ANIMAL_TYPES.has(dto.type) &&
                Object.keys(recordDto(id).payload ?? {}).length === 0) {
                rows.set(id, {
                    ...base,
                    status: 'SKIPPED',
                    reason: 'VALUES_MISSING',
                    findings: [],
                });
                continue;
            }
            const dry = (await this.writer.record(farmId, userId, id, recordDto(id), {
                dryRun: true,
            }));
            if (dry.blocked) {
                rows.set(id, {
                    ...base,
                    status: mode === 'allOrNothing' ? 'BLOCKED' : 'SKIPPED',
                    reason: dry.findings.find((f) => f.severity === 'BLOCK')?.code,
                    findings: dry.findings,
                });
            }
            else {
                rows.set(id, { ...base, status: 'ELIGIBLE', findings: dry.findings });
                eligible.push(id);
            }
        }
        const ordered = () => requested.map((id) => rows.get(id));
        const skippedRows = () => [...rows.values()].filter((r) => r.status === 'SKIPPED' || r.status === 'BLOCKED');
        if (mode === 'allOrNothing' && skippedRows().length) {
            throw (0, parse_payload_1.eventError)('BULK_BLOCKED', `${skippedRows().length} animal(s) cannot take ${dto.type}; nothing was saved`, { results: ordered() });
        }
        const eventAt = new Date(dto.eventAt);
        if (opts.dryRun || eligible.length === 0) {
            return {
                dryRun: Boolean(opts.dryRun),
                batchId: null,
                type: dto.type,
                eventAt,
                mode,
                requested: ids.length,
                saved: 0,
                skipped: skippedRows().length,
                results: ordered(),
            };
        }
        const taskSink = [];
        const batchId = await this.prisma.$transaction(async (tx) => tx_context_1.txStore.run({ tx }, async () => {
            await tx.$queryRaw `SELECT id FROM "Cattle" WHERE id = ANY(${eligible}::text[]) ORDER BY id FOR UPDATE`;
            const batch = await tx.animalEventBatch.create({
                data: {
                    farmId,
                    type: dto.type,
                    eventAt,
                    category: dto.category ?? null,
                    notes: dto.notes ?? null,
                    requested: ids.length,
                    saved: 0,
                    recordedById: userId,
                },
            });
            let saved = 0;
            for (const id of eligible) {
                try {
                    const res = (await this.writer.record(farmId, userId, id, recordDto(id), { batchId: batch.id, taskSink }));
                    rows.set(id, {
                        ...rows.get(id),
                        status: 'CREATED',
                        eventId: res.event.id,
                        findings: res.findings,
                    });
                    saved++;
                }
                catch (e) {
                    const blocked = this.blockFindings(e);
                    if (mode !== 'skipIneligible' || !blocked)
                        throw e;
                    rows.set(id, {
                        ...rows.get(id),
                        status: 'SKIPPED',
                        reason: blocked.find((f) => f.severity === 'BLOCK')?.code,
                        findings: blocked,
                    });
                }
            }
            await tx.animalEventBatch.update({
                where: { id: batch.id },
                data: {
                    saved,
                    skipped: skippedRows().map((r) => ({
                        cattleId: r.cattleId,
                        reason: r.reason ?? null,
                    })),
                },
            });
            return batch.id;
        }), { timeout: 120_000, maxWait: 10_000 });
        await this.taskNotifier.syncByIds(farmId, taskSink).catch((err) => this.log.warn('Bulk follow-up notification sync failed', {
            error: err instanceof Error ? err.message : String(err),
        }));
        const results = ordered();
        const saved = results.filter((r) => r.status === 'CREATED').length;
        await this.afterCommit(farmId, userId, dto, batchId, saved, ids.length);
        return {
            dryRun: false,
            batchId,
            type: dto.type,
            eventAt,
            mode,
            requested: ids.length,
            saved,
            skipped: results.length - saved,
            results,
        };
    }
    blockFindings(e) {
        if (!(e instanceof common_1.UnprocessableEntityException))
            return null;
        const body = e.getResponse();
        const all = body.details?.findings;
        return all?.some((f) => f.severity === 'BLOCK') ? all : null;
    }
    async afterCommit(farmId, userId, dto, batchId, saved, requested) {
        try {
            await this.activity.record({
                farmId,
                module: client_1.ActivityLogModule.COW_MANAGEMENT,
                eventTitle: 'Bulk animal event',
                actionDetails: `${dto.type} recorded for ${saved} of ${requested} animals.`,
                actorId: userId,
                taggedValues: [{ key: 'batchId', value: batchId }],
            });
            if (saved === 0)
                return;
            const members = await this.prisma.farmMember.findMany({
                where: {
                    farmId,
                    userId: { not: userId },
                    role: { name: { in: ['Owner', 'Manager'] } },
                },
                select: { userId: true },
            });
            await this.notifications.notifyUsers({
                farmId,
                userIds: members.map((m) => m.userId),
                eventKey: 'bulk_event_recorded',
                title: 'Bulk event recorded',
                message: `${dto.type}: ${saved} of ${requested} animals recorded.`,
                params: { type: dto.type, saved, requested },
                link: '/cattle',
                dedupeKey: `bulk_event_recorded:${batchId}`,
            });
        }
        catch (err) {
            this.log.error('Bulk event follow-through failed', {
                batchId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
exports.BulkEventService = BulkEventService;
exports.BulkEventService = BulkEventService = BulkEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        animal_event_write_service_1.AnimalEventWriteService,
        activity_log_service_1.ActivityLogService,
        notification_service_1.NotificationService,
        task_notification_producer_1.TaskNotificationProducer,
        event_registry_1.EventRegistry,
        logger_service_1.LoggerService])
], BulkEventService);
//# sourceMappingURL=bulk-event.service.js.map