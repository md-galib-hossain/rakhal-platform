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
var ActivityLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const crypto_1 = require("src/common/crypto");
const pagination_1 = require("src/common/pagination");
const MODULE_LABELS = {
    COW_MANAGEMENT: 'Cow Management',
    MILK_PRODUCTION: 'Milk Production',
    HEALTH_SAFETY: 'Health & Safety',
    FINANCE: 'Finance',
    BREEDING: 'Breeding',
    INVENTORY: 'Inventory',
    GENERAL: 'General',
};
let ActivityLogService = ActivityLogService_1 = class ActivityLogService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ActivityLogService_1.name);
    }
    async record(input) {
        return this.prisma.$transaction(async (tx) => {
            const last = await tx.activityLog.findFirst({
                where: { farmId: input.farmId },
                orderBy: { createdAt: 'desc' },
                select: { hash: true },
            });
            const prevHash = last?.hash ?? null;
            const timestamp = new Date();
            const taggedValues = input.taggedValues ?? null;
            const hash = this.computeHash(input, timestamp, taggedValues, prevHash);
            return tx.activityLog.create({
                data: {
                    farmId: input.farmId,
                    timestamp,
                    module: input.module,
                    eventTitle: input.eventTitle,
                    actionDetails: input.actionDetails,
                    ...(taggedValues
                        ? { taggedValues: taggedValues }
                        : {}),
                    aqrImpact: input.aqrImpact ?? null,
                    financialImpact: input.financialImpact ?? null,
                    previousAqrScore: input.previousAqrScore ?? null,
                    actorId: input.actorId ?? null,
                    relatedCattleId: input.relatedCattleId ?? null,
                    prevHash,
                    hash,
                },
            });
        });
    }
    async list(farmId, query) {
        const where = {
            farmId,
            ...(query.module ? { module: query.module } : {}),
            ...(query.actorId ? { actorId: query.actorId } : {}),
            ...(query.aqrImpactOnly ? { aqrImpact: { not: null } } : {}),
            ...(query.financialImpactOnly ? { financialImpact: { not: null } } : {}),
            ...(query.from || query.to
                ? {
                    timestamp: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
        };
        const rows = await this.prisma.activityLog.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { actor: { select: { id: true, name: true } } },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((row) => this.present(row)),
            meta: page.meta,
        };
    }
    async verifyChain(farmId) {
        const rows = await this.prisma.activityLog.findMany({
            where: { farmId },
            orderBy: { createdAt: 'asc' },
        });
        let prevHash = null;
        for (const row of rows) {
            const expected = this.computeHash({
                farmId: row.farmId,
                module: row.module,
                eventTitle: row.eventTitle,
                actionDetails: row.actionDetails,
                aqrImpact: row.aqrImpact,
                financialImpact: row.financialImpact,
                actorId: row.actorId,
                relatedCattleId: row.relatedCattleId,
            }, row.timestamp, row.taggedValues ?? null, prevHash);
            if (row.prevHash !== prevHash || row.hash !== expected) {
                return { valid: false, entries: rows.length, brokenAt: row.id };
            }
            prevHash = row.hash;
        }
        return { valid: true, entries: rows.length, brokenAt: null };
    }
    computeHash(input, timestamp, taggedValues, prevHash) {
        return (0, crypto_1.sha256Hex)(JSON.stringify({
            farmId: input.farmId,
            timestamp: timestamp.toISOString(),
            module: input.module,
            eventTitle: input.eventTitle,
            actionDetails: input.actionDetails,
            taggedValues,
            aqrImpact: input.aqrImpact ?? null,
            financialImpact: input.financialImpact ?? null,
            actorId: input.actorId ?? null,
            relatedCattleId: input.relatedCattleId ?? null,
            prevHash,
        }));
    }
    present(row) {
        return {
            ...row,
            moduleLabel: MODULE_LABELS[row.module],
            dateGroup: row.timestamp.toISOString().slice(0, 10),
            actor: row.actor ?? { id: null, name: 'System' },
            actorType: row.actorId ? 'user' : 'system',
        };
    }
};
exports.ActivityLogService = ActivityLogService;
exports.ActivityLogService = ActivityLogService = ActivityLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ActivityLogService);
//# sourceMappingURL=activity-log.service.js.map