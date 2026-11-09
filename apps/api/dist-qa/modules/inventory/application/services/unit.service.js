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
var UnitService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitService = void 0;
exports.resolveKgPerUnit = resolveKgPerUnit;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const inventory_activity_service_1 = require("./inventory-activity.service");
function resolveKgPerUnit(unit, storedKgPerUnit) {
    if (unit.dimension === 'WEIGHT')
        return unit.conversionToBase;
    return storedKgPerUnit;
}
let UnitService = UnitService_1 = class UnitService {
    prisma;
    activity;
    log;
    constructor(prisma, logger, activity) {
        this.prisma = prisma;
        this.activity = activity;
        this.log = logger.setContext(UnitService_1.name);
    }
    async findAll(farmId, query) {
        const where = {
            OR: [{ farmId: null }, { farmId }],
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.dimension ? { dimension: query.dimension } : {}),
        };
        return this.prisma.unit.findMany({
            where,
            orderBy: [
                { dimension: 'asc' },
                { isSystemDefault: 'desc' },
                { name: 'asc' },
            ],
        });
    }
    async create(farmId, dto, userId) {
        const unit = await this.prisma.unit.create({
            data: {
                farmId,
                name: dto.name,
                symbol: dto.symbol,
                dimension: dto.dimension,
                conversionToBase: dto.conversionToBase,
                isSystemDefault: false,
            },
        });
        this.log.info('Farm-custom unit created', { unitId: unit.id, farmId });
        await this.activity.record(farmId, userId, 'Custom Unit Added', `Custom unit "${unit.name}" (${unit.symbol}, ${unit.dimension}) added.`);
        return unit;
    }
    async archive(farmId, unitId, userId) {
        const unit = await this.prisma.unit.findFirst({
            where: { id: unitId, farmId, deletedAt: null },
        });
        if (!unit) {
            throw new common_1.NotFoundException('Custom unit not found');
        }
        const archived = await this.prisma.unit.update({
            where: { id: unitId },
            data: { deletedAt: new Date() },
        });
        this.log.info('Farm-custom unit archived', { unitId, farmId });
        await this.activity.record(farmId, userId, 'Custom Unit Archived', `Custom unit "${archived.name}" (${archived.symbol}) archived.`);
        return archived;
    }
};
exports.UnitService = UnitService;
exports.UnitService = UnitService = UnitService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService])
], UnitService);
//# sourceMappingURL=unit.service.js.map