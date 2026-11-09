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
var MilkQualityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkQualityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
let MilkQualityService = MilkQualityService_1 = class MilkQualityService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(MilkQualityService_1.name);
    }
    async create(farmId, userId, dto) {
        await this.assertCattleInFarm(farmId, dto.cattleId);
        await this.assertLactationBelongsToCattle(dto.lactationId, dto.cattleId);
        const test = await this.prisma.milkQualityTest.create({
            data: {
                farmId,
                cattleId: dto.cattleId,
                lactationId: dto.lactationId,
                sampleDate: new Date(dto.sampleDate),
                fatPct: dto.fatPct,
                proteinPct: dto.proteinPct,
                lactosePct: dto.lactosePct,
                somaticCellCount: dto.somaticCellCount,
                milkUreaNitrogen: dto.milkUreaNitrogen,
                source: dto.source,
                notes: dto.notes,
                createdBy: userId,
            },
        });
        this.log.info('Milk quality test recorded', {
            farmId,
            cattleId: dto.cattleId,
            testId: test.id,
        });
        return test;
    }
    async list(farmId, query) {
        const rows = await this.prisma.milkQualityTest.findMany({
            where: {
                farmId,
                ...(query.cattleId ? { cattleId: query.cattleId } : {}),
                ...(query.lactationId ? { lactationId: query.lactationId } : {}),
            },
            orderBy: [{ sampleDate: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async latestForCattle(farmId, cattleId) {
        return this.prisma.milkQualityTest.findFirst({
            where: { farmId, cattleId },
            orderBy: [{ sampleDate: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true },
        });
        if (!cattle) {
            throw new common_1.NotFoundException('Cattle not found in this farm, not in the active herd, or deleted.');
        }
    }
    async assertLactationBelongsToCattle(lactationId, cattleId) {
        const lactation = await this.prisma.lactation.findFirst({
            where: { id: lactationId, cattleId },
            select: { id: true },
        });
        if (!lactation) {
            throw new common_1.NotFoundException('Lactation not found for this cow, or does not belong to it.');
        }
    }
};
exports.MilkQualityService = MilkQualityService;
exports.MilkQualityService = MilkQualityService = MilkQualityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], MilkQualityService);
//# sourceMappingURL=milk-quality.service.js.map