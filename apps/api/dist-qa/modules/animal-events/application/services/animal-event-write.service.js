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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalEventWriteService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const categories_1 = require("../../domain/eligibility/categories");
const evaluate_1 = require("../../domain/eligibility/evaluate");
const event_registry_1 = require("../../domain/event-registry");
const findings_1 = require("../../domain/findings");
const event_api_context_1 = require("../event-api-context");
const event_handler_1 = require("../event-handler");
const parse_payload_1 = require("../parse-payload");
const follow_up_service_1 = require("./follow-up.service");
const custom_event_type_service_1 = require("./custom-event-type.service");
const custom_type_1 = require("../../domain/custom-type");
const animal_event_types_service_1 = require("./animal-event-types.service");
const eligibility_service_1 = require("./eligibility.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_AFTER_DAYS = 7;
const GENERIC_TYPES = new Set([
    'ENTER_FATTENING',
    'LEAVE_FATTENING',
    'NOTE',
    'CUSTOM',
]);
let AnimalEventWriteService = class AnimalEventWriteService {
    prisma;
    eligibility;
    handlers;
    registry;
    followUps;
    customTypes;
    constructor(prisma, eligibility, handlers, registry, followUps, customTypes) {
        this.prisma = prisma;
        this.eligibility = eligibility;
        this.handlers = handlers;
        this.registry = registry;
        this.followUps = followUps;
        this.customTypes = customTypes;
    }
    async record(farmId, userId, cattleId, dto, opts = {}) {
        let def = this.registry.get(dto.type);
        if (!def) {
            throw (0, parse_payload_1.eventError)('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
        }
        let customTypeId;
        if (dto.type === 'CUSTOM') {
            const row = dto.customTypeId
                ? await this.customTypes.get(farmId, dto.customTypeId).catch(() => null)
                : null;
            if (!row || !row.isActive) {
                throw (0, parse_payload_1.eventError)('CUSTOM_TYPE_UNKNOWN', 'customTypeId is required and must be an active custom type of this farm');
            }
            const problems = (0, custom_type_1.validateCustomPayload)(row.fields, dto.payload ?? {});
            if (problems.length) {
                throw (0, parse_payload_1.eventError)('EVENT_PAYLOAD_INVALID', 'Event payload is invalid', {
                    problems,
                });
            }
            def = (0, custom_type_1.toDefinition)(row);
            customTypeId = row.id;
        }
        const handler = this.handlers.get(dto.type);
        if (!handler && !GENERIC_TYPES.has(dto.type)) {
            throw (0, parse_payload_1.eventError)('EVENT_TYPE_NOT_SUPPORTED', `Event type ${dto.type} cannot be recorded through this API yet`);
        }
        const eventAt = new Date(dto.eventAt);
        const now = new Date();
        const provenance = dto.provenance ??
            (now.getTime() - eventAt.getTime() > HISTORICAL_AFTER_DAYS * DAY_MS
                ? 'HISTORICAL'
                : 'RECORDED');
        if (provenance === 'HISTORICAL' && !def.allowsHistorical) {
            throw (0, parse_payload_1.eventError)('EVENT_HISTORICAL_NOT_ALLOWED', `${dto.type} cannot be recorded as a history entry`);
        }
        const { facts, ctx, leftHerd } = await this.eligibility.loadFacts(farmId, cattleId, now);
        const result = (0, evaluate_1.evaluateEligibility)(def, {
            facts,
            ctx,
            date: eventAt,
            leftHerd,
        });
        const payload = dto.payload ?? {};
        const hasPendingBreeding = (await this.prisma.breedingEvent.count({
            where: { cattleId, status: 'PENDING_CHECK', voidedAt: null },
        })) > 0;
        const findings = (0, findings_1.buildFindings)(def, result, {
            categories: (0, categories_1.categoriesOf)(facts, ctx),
            hasPendingBreeding,
            breedingGiven: Boolean(payload.breedingEventId),
        });
        const extra = handler?.findingsFor
            ? await handler.findingsFor(dto.type, { cattleId, payload })
            : [];
        for (const code of extra) {
            if (!findings.some((f) => f.code === code))
                findings.push({ code, severity: 'WARN' });
        }
        const ruleEvent = this.ruleEvent(dto, payload, eventAt);
        const followUpsPreview = await this.followUps.preview(farmId, ruleEvent, dto.followUps);
        const blocks = findings.filter((f) => f.severity === 'BLOCK');
        if (opts.dryRun) {
            return {
                dryRun: true,
                type: dto.type,
                eventAt,
                provenance,
                blocked: blocks.length > 0,
                findings,
                followUpsPreview,
            };
        }
        if (blocks.length) {
            throw (0, parse_payload_1.eventError)(blocks[0].code, `${dto.type} cannot be recorded for this animal`, { findings });
        }
        return this.withIdempotency(farmId, opts.idempotencyKey, `animal-events.record:${cattleId}`, async () => {
            const warnings = findings.filter((f) => f.severity === 'WARN');
            const c = {
                farmId,
                userId,
                cattleId,
                eventAt,
                provenance,
                payload,
                warnings,
                customTypeId,
                batchId: opts.batchId,
                taskSink: opts.taskSink,
            };
            const { eventId, detail } = await this.save(handler, dto, c, ruleEvent);
            const event = await this.prisma.animalEvent.findUniqueOrThrow({
                where: { id: eventId },
            });
            return JSON.parse(JSON.stringify({
                dryRun: false,
                event,
                detail,
                findings,
                followUpsPreview,
            }));
        });
    }
    async save(handler, dto, c, ruleEvent) {
        const generic = this.genericData(dto, c);
        const eventId = `ae_${(0, node_crypto_1.randomUUID)().replace(/-/g, '')}`;
        return this.prisma.$transaction(async (tx) => tx_context_1.txStore.run({ tx }, async () => {
            await tx.animalEvent.create({
                data: {
                    id: eventId,
                    farmId: c.farmId,
                    cattleId: c.cattleId,
                    type: dto.type,
                    eventAt: c.eventAt,
                    ...(c.customTypeId ? { customTypeId: c.customTypeId } : {}),
                    ...(generic ? { data: generic } : {}),
                    ...this.meta(dto, c),
                },
            });
            let detail = null;
            if (handler) {
                await tx.$queryRaw `SELECT set_config('app.event_id', ${eventId}, true), set_config('app.event_type', ${dto.type}, true)`;
                const res = await (0, event_api_context_1.runInEventApi)({ historical: c.provenance === 'HISTORICAL' }, () => handler.handle(dto.type, {
                    farmId: c.farmId,
                    userId: c.userId,
                    cattleId: c.cattleId,
                    eventAt: c.eventAt,
                    notes: dto.notes,
                    provenance: c.provenance,
                    payload: c.payload,
                }));
                if (res.headerData) {
                    await tx.animalEvent.update({
                        where: { id: eventId },
                        data: { data: res.headerData },
                    });
                }
                detail = res.detail;
            }
            await this.followUps.onEventSaved({
                farmId: c.farmId,
                userId: c.userId,
                cattleId: c.cattleId,
                eventId,
                event: ruleEvent,
                toggles: dto.followUps,
                taskSink: c.taskSink,
            });
            return { eventId, detail };
        }), { timeout: 30_000, maxWait: 10_000 });
    }
    ruleEvent(dto, payload, eventAt) {
        const ev = { type: dto.type, eventAt, payload };
        if (dto.type === 'PREG_CHECK') {
            const r = payload.result;
            ev.result = r === 'NOT_PREGNANT' || r === 'SUSPECTED' ? r : 'PREGNANT';
            const given = typeof payload.expectedCalvingDate === 'string'
                ? new Date(payload.expectedCalvingDate)
                : null;
            const gd = Number(payload.gestationDay);
            ev.expectedCalvingDate =
                given ??
                    (gd > 0 ? new Date(eventAt.getTime() + (280 - gd) * DAY_MS) : null);
        }
        return ev;
    }
    genericData(dto, c) {
        if (!GENERIC_TYPES.has(dto.type))
            return null;
        let data;
        if (dto.type === 'CUSTOM') {
            data = c.payload;
        }
        else if (dto.type === 'NOTE') {
            const text = typeof c.payload.text === 'string' ? c.payload.text.trim() : '';
            if (!text) {
                throw (0, parse_payload_1.eventError)('EVENT_PAYLOAD_INVALID', 'A note needs payload.text');
            }
            data = { text };
        }
        else {
            data = c.payload;
        }
        if (JSON.stringify(data).length > 4096) {
            throw (0, parse_payload_1.eventError)('EVENT_PAYLOAD_INVALID', 'Event payload exceeds 4 KB');
        }
        return data;
    }
    meta(dto, c) {
        return {
            provenance: c.provenance,
            notes: dto.notes ?? null,
            sourceEventId: dto.sourceEventId ?? null,
            ...(c.batchId ? { batchId: c.batchId } : {}),
            recordedById: c.userId,
            findings: c.warnings.length
                ? c.warnings
                : client_1.Prisma.JsonNull,
        };
    }
    async withIdempotency(farmId, key, endpoint, fn) {
        if (!key)
            return fn();
        try {
            await this.prisma.idempotencyKey.create({
                data: { farmId, key, endpoint },
            });
        }
        catch (error) {
            if (error.code !== 'P2002')
                throw error;
            const existing = await this.prisma.idempotencyKey.findUnique({
                where: { farmId_key_endpoint: { farmId, key, endpoint } },
            });
            if (existing?.responseBody)
                return existing.responseBody;
            throw new common_1.ConflictException('An identical request with this Idempotency-Key is already in progress');
        }
        try {
            const result = await fn();
            await this.prisma.idempotencyKey.update({
                where: { farmId_key_endpoint: { farmId, key, endpoint } },
                data: { responseBody: result },
            });
            return result;
        }
        catch (e) {
            await this.prisma.idempotencyKey
                .delete({ where: { farmId_key_endpoint: { farmId, key, endpoint } } })
                .catch(() => undefined);
            throw e;
        }
    }
};
exports.AnimalEventWriteService = AnimalEventWriteService;
exports.AnimalEventWriteService = AnimalEventWriteService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        eligibility_service_1.EligibilityService,
        event_handler_1.EventHandlerRegistry,
        event_registry_1.EventRegistry,
        follow_up_service_1.FollowUpService,
        custom_event_type_service_1.CustomEventTypeService])
], AnimalEventWriteService);
//# sourceMappingURL=animal-event-write.service.js.map