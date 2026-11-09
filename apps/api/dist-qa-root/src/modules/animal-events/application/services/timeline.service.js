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
exports.TimelineService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const event_registry_1 = require("../../domain/event-registry");
const animal_event_types_service_1 = require("./animal-event-types.service");
const encode = (c) => Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
function decode(raw) {
    try {
        const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        return c.at && c.type && c.id && !Number.isNaN(Date.parse(c.at)) ? c : null;
    }
    catch {
        return null;
    }
}
let TimelineService = class TimelineService {
    prisma;
    registry;
    constructor(prisma, registry) {
        this.prisma = prisma;
        this.registry = registry;
    }
    async list(farmId, cattleId, query) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true },
        });
        if (!cattle)
            throw new common_1.NotFoundException('Animal not found');
        const limit = query.limit ?? 30;
        const conds = [
            client_1.Prisma.sql `"farmId" = ${farmId}`,
            client_1.Prisma.sql `"cattleId" = ${cattleId}`,
        ];
        if (!query.includeVoided)
            conds.push(client_1.Prisma.sql `status = 'ACTIVE'`);
        if (query.group) {
            const types = this.registry
                .all()
                .filter((d) => d.group === query.group)
                .map((d) => d.type);
            if (!types.length)
                return this.page([], limit);
            conds.push(client_1.Prisma.sql `type::text IN (${client_1.Prisma.join(types)})`);
        }
        const cursor = query.cursor ? decode(query.cursor) : null;
        if (cursor) {
            const at = new Date(cursor.at);
            conds.push(client_1.Prisma.sql `("eventAt" < ${at} OR ("eventAt" = ${at} AND (type::text < ${cursor.type} OR (type::text = ${cursor.type} AND id < ${cursor.id}))))`);
        }
        const ids = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT id FROM "AnimalEvent" WHERE ${client_1.Prisma.join(conds, ' AND ')}
                 ORDER BY "eventAt" DESC, type::text DESC, id DESC LIMIT ${limit + 1}`);
        const events = await this.prisma.animalEvent.findMany({
            where: { id: { in: ids.map((r) => r.id) } },
        });
        const order = new Map(ids.map((r, i) => [r.id, i]));
        events.sort((a, b) => order.get(a.id) - order.get(b.id));
        const details = await this.loadDetails(events.map((e) => e.id));
        const rows = events.map((e) => ({
            ...e,
            detail: details.get(e.id) ?? null,
        }));
        return this.page(rows, limit);
    }
    page(rows, limit) {
        const hasNextPage = rows.length > limit;
        const items = hasNextPage ? rows.slice(0, limit) : rows;
        const last = items[items.length - 1];
        return {
            items,
            meta: {
                count: items.length,
                limit,
                hasNextPage,
                endCursor: hasNextPage && last?.eventAt && last.type
                    ? encode({
                        at: last.eventAt.toISOString(),
                        type: last.type,
                        id: last.id,
                    })
                    : null,
            },
        };
    }
    async loadDetails(eventIds) {
        const where = { animalEventId: { in: eventIds } };
        const p = this.prisma;
        const lists = await Promise.all([
            p.heatEvent.findMany({ where }),
            p.breedingEvent.findMany({ where }),
            p.pregnancyDiagnosis.findMany({ where }),
            p.calvingEvent.findMany({ where }),
            p.abortionEvent.findMany({ where }),
            p.dryPeriod.findMany({ where }),
            p.weightRecord.findMany({ where }),
            p.calfWeightRecord.findMany({ where }),
            p.bodyConditionScore.findMany({ where }),
            p.treatmentLog.findMany({ where }),
            p.cattleDisposition.findMany({ where }),
            p.mortalityRecord.findMany({ where }),
            p.calfWeaningRecord.findMany({ where }),
        ]);
        const out = new Map();
        for (const list of lists) {
            for (const row of list)
                if (row.animalEventId)
                    out.set(row.animalEventId, row);
        }
        return out;
    }
};
exports.TimelineService = TimelineService;
exports.TimelineService = TimelineService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_registry_1.EventRegistry])
], TimelineService);
//# sourceMappingURL=timeline.service.js.map