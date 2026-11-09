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
var AnimalHoldService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalHoldService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const HOLD_TYPE_LABEL = {
    REPRODUCTIVE: 'Reproductive',
    MILK_DISCARD: 'Milk discard',
    QUARANTINE: 'Quarantine',
    OTHER: 'Other',
};
let AnimalHoldService = AnimalHoldService_1 = class AnimalHoldService {
    prisma;
    activityLog;
    log;
    constructor(prisma, activityLog, logger) {
        this.prisma = prisma;
        this.activityLog = activityLog;
        this.log = logger.setContext(AnimalHoldService_1.name);
    }
    async createHold(farmId, userId, cattleId, dto) {
        const cattle = await this.assertCattleInFarm(farmId, cattleId);
        const hold = await this.prisma.animalHold.create({
            data: {
                farmId,
                cattleId,
                type: dto.type,
                reason: dto.reason,
                createdBy: userId,
            },
        });
        this.log.info('Animal hold created', {
            farmId,
            cattleId,
            holdId: hold.id,
            type: hold.type,
        });
        await this.activityLog.record({
            farmId,
            module: 'COW_MANAGEMENT',
            eventTitle: `${HOLD_TYPE_LABEL[hold.type]} hold placed`,
            actionDetails: `${cattle.tagNumber}: ${dto.reason}`,
            actorId: userId,
            relatedCattleId: cattleId,
            taggedValues: [
                { key: 'holdId', value: hold.id },
                { key: 'type', value: hold.type },
            ],
        });
        return hold;
    }
    async releaseAllForCattle(farmId, cattleId, releasedBy) {
        await this.prisma.animalHold.updateMany({
            where: { farmId, cattleId, endedAt: null },
            data: { endedAt: new Date(), releasedBy },
        });
    }
    async releaseHold(farmId, cattleId, holdId, releasedBy, dto) {
        const cattle = await this.assertCattleInFarm(farmId, cattleId);
        const existing = await this.prisma.animalHold.findFirst({
            where: { id: holdId, farmId, cattleId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Animal hold not found');
        }
        if (existing.endedAt) {
            return existing;
        }
        const hold = await this.prisma.animalHold.update({
            where: { id: holdId },
            data: {
                endedAt: new Date(),
                releasedBy,
            },
        });
        this.log.info('Animal hold released', {
            farmId,
            cattleId,
            holdId: hold.id,
            type: hold.type,
        });
        await this.activityLog.record({
            farmId,
            module: 'COW_MANAGEMENT',
            eventTitle: `${HOLD_TYPE_LABEL[hold.type]} hold released`,
            actionDetails: dto?.note
                ? `${cattle.tagNumber}: ${dto.note}`
                : `${cattle.tagNumber}`,
            actorId: releasedBy,
            relatedCattleId: cattleId,
            taggedValues: [
                { key: 'holdId', value: hold.id },
                { key: 'type', value: hold.type },
            ],
        });
        return hold;
    }
    async activeHoldsForCattle(farmId, cattleId, type) {
        return this.prisma.animalHold.findMany({
            where: {
                farmId,
                cattleId,
                endedAt: null,
                ...(type ? { type } : {}),
            },
            orderBy: { startedAt: 'desc' },
        });
    }
    async list(farmId, cattleId, query) {
        await this.assertCattleInFarm(farmId, cattleId);
        const where = {
            farmId,
            cattleId,
            ...(query.type ? { type: query.type } : {}),
            ...(query.includeReleased ? {} : { endedAt: null }),
        };
        const rows = await this.prisma.animalHold.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true, tagNumber: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found');
        }
        return cattle;
    }
};
exports.AnimalHoldService = AnimalHoldService;
exports.AnimalHoldService = AnimalHoldService = AnimalHoldService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], AnimalHoldService);
//# sourceMappingURL=animal-hold.service.js.map