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
var MilkTankService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkTankService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const inventory_activity_service_1 = require("./inventory-activity.service");
const pagination_1 = require("src/common/pagination");
const DEFAULT_TANK_CAPACITY_L = 100_000;
let MilkTankService = MilkTankService_1 = class MilkTankService {
    prisma;
    activity;
    log;
    constructor(prisma, logger, activity) {
        this.prisma = prisma;
        this.activity = activity;
        this.log = logger.setContext(MilkTankService_1.name);
    }
    recordActivity(farmId, actorId, eventTitle, actionDetails) {
        return this.activity.record(farmId, actorId, eventTitle, actionDetails);
    }
    async findAll(farmId, query) {
        const tanks = await this.prisma.milkTank.findMany({
            where: {
                farmId,
                ...(query.includeArchived ? {} : { deletedAt: null }),
                ...(query.tankType ? { tankType: query.tankType } : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
        return tanks.map((tank) => this.present(tank));
    }
    async findOne(farmId, id) {
        return this.present(await this.getOrThrow(farmId, id));
    }
    async create(farmId, userId, dto) {
        const currentVolumeL = dto.currentVolumeL ?? 0;
        if (currentVolumeL > dto.totalCapacityL) {
            throw new common_1.BadRequestException('Volume cannot exceed tank capacity');
        }
        await this.assertShedInFarm(farmId, dto.assignedShedId);
        const tank = await this.prisma.milkTank.create({
            data: {
                farmId,
                name: dto.name,
                tankType: dto.tankType,
                totalCapacityL: dto.totalCapacityL,
                currentVolumeL,
                fatPct: dto.fatPct,
                proteinPct: dto.proteinPct,
                snfPct: dto.snfPct,
                smartSensorId: dto.smartSensorId,
                targetTempC: dto.targetTempC,
                agitationIntervalMin: dto.agitationIntervalMin,
                assignedShedId: dto.assignedShedId,
                createdBy: userId,
            },
        });
        this.log.info('Milk tank created', { tankId: tank.id, farmId });
        await this.recordActivity(farmId, userId, 'Milk Tank Created', `Milk tank "${tank.name}" (${tank.tankType}) created — capacity ${tank.totalCapacityL}L, opening volume ${tank.currentVolumeL}L.`);
        return this.present(tank);
    }
    async update(farmId, id, dto, userId) {
        const existing = await this.getOrThrow(farmId, id);
        await this.assertShedInFarm(farmId, dto.assignedShedId);
        const totalCapacityL = dto.totalCapacityL ?? existing.totalCapacityL;
        if (existing.currentVolumeL > totalCapacityL) {
            throw new common_1.BadRequestException('New capacity is below the current stored volume');
        }
        const tank = await this.prisma.milkTank.update({
            where: { id },
            data: {
                name: dto.name,
                tankType: dto.tankType,
                totalCapacityL: dto.totalCapacityL,
                fatPct: dto.fatPct,
                proteinPct: dto.proteinPct,
                snfPct: dto.snfPct,
                smartSensorId: dto.smartSensorId,
                targetTempC: dto.targetTempC,
                agitationIntervalMin: dto.agitationIntervalMin,
                assignedShedId: dto.assignedShedId,
            },
        });
        this.log.info('Milk tank updated', { tankId: id, farmId });
        await this.recordActivity(farmId, userId, 'Milk Tank Updated', `Milk tank "${tank.name}" settings updated.`);
        return this.present(tank);
    }
    async adjustVolumeManual(farmId, userId, id, dto) {
        const before = await this.getOrThrow(farmId, id);
        const tank = await this.adjustVolume(farmId, userId, id, dto);
        const sign = dto.delta > 0 ? '+' : '';
        await this.recordActivity(farmId, userId, 'Milk Tank Volume Adjusted', `Milk tank "${tank.name}" adjusted ${sign}${dto.delta}L (${dto.activityType}) — ${before.currentVolumeL}L to ${tank.currentVolumeL}L.${dto.notes ? ` Note: ${dto.notes}` : ''}`);
        return tank;
    }
    async adjustVolume(farmId, userId, id, dto, tx, opts) {
        const existing = await this.getOrThrow(farmId, id, tx ?? this.prisma);
        const balanceAfterL = existing.currentVolumeL + dto.delta;
        if (dto.delta === 0) {
            throw new common_1.BadRequestException('Volume change must be non-zero');
        }
        if (balanceAfterL < 0) {
            throw new common_1.BadRequestException('Tank volume cannot go below zero');
        }
        if (!opts?.allowOverCapacity && balanceAfterL > existing.totalCapacityL) {
            throw new common_1.BadRequestException('Tank volume cannot exceed capacity');
        }
        const write = async (client) => {
            const updatedTank = await client.milkTank.update({
                where: { id },
                data: { currentVolumeL: balanceAfterL },
            });
            await client.milkTankAuditLog.create({
                data: {
                    milkTankId: id,
                    farmId,
                    activityType: dto.activityType,
                    quantityL: dto.delta,
                    balanceAfterL,
                    source: dto.source,
                    notes: dto.notes,
                    saleLineId: dto.saleLineId,
                    createdBy: userId,
                },
            });
            return updatedTank;
        };
        const tank = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        this.log.info('Milk tank volume adjusted', {
            tankId: id,
            farmId,
            delta: dto.delta,
            balanceAfterL,
        });
        return this.present(tank);
    }
    async ensureDefaultSellableTank(farmId, userId, tx) {
        const find = () => tx.milkTank.findFirst({
            where: { farmId, tankType: client_1.MilkTankType.SELLABLE, deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });
        const existing = await find();
        if (existing)
            return existing;
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`milk-default-tank:${farmId}`}))`;
        const raced = await find();
        if (raced)
            return raced;
        const hasPrimary = await tx.milkTank.count({
            where: { farmId, deletedAt: null, isPrimary: true },
        });
        const tank = await tx.milkTank.create({
            data: {
                farmId,
                name: 'Main Tank',
                tankType: client_1.MilkTankType.SELLABLE,
                totalCapacityL: DEFAULT_TANK_CAPACITY_L,
                currentVolumeL: 0,
                isPrimary: hasPrimary === 0,
                createdBy: userId,
            },
        });
        this.log.info('Default sellable milk tank created', {
            tankId: tank.id,
            farmId,
        });
        return tank;
    }
    async setPrimary(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const tank = await this.prisma.$transaction(async (tx) => {
            await tx.milkTank.updateMany({
                where: { farmId, isPrimary: true },
                data: { isPrimary: false },
            });
            return tx.milkTank.update({
                where: { id },
                data: { isPrimary: true },
            });
        });
        await this.recordActivity(farmId, userId, 'Primary Milk Tank Set', `Milk tank "${tank.name}" set as primary ${tank.tankType} tank.`);
        return this.present(tank);
    }
    async archive(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const tank = await this.prisma.milkTank.update({
            where: { id },
            data: { deletedAt: new Date(), isPrimary: false },
        });
        await this.recordActivity(farmId, userId, 'Milk Tank Archived', `Milk tank "${tank.name}" archived.`);
        return this.present(tank);
    }
    async auditLog(farmId, query) {
        const where = {
            farmId,
            ...(query.tankId ? { milkTankId: query.tankId } : {}),
        };
        const rows = await this.prisma.milkTankAuditLog.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async getOrThrow(farmId, id, client = this.prisma) {
        const tank = await client.milkTank.findFirst({
            where: { id, farmId },
        });
        if (!tank)
            throw new common_1.NotFoundException('Milk tank not found');
        return tank;
    }
    async assertShedInFarm(farmId, shedId) {
        if (!shedId)
            return;
        const shed = await this.prisma.shed.findFirst({
            where: { id: shedId, farmId },
            select: { id: true },
        });
        if (!shed) {
            throw new common_1.BadRequestException('Assigned shed must belong to this farm');
        }
    }
    present(tank) {
        return {
            ...tank,
            fillPct: tank.totalCapacityL > 0
                ? Math.round((tank.currentVolumeL / tank.totalCapacityL) * 1000) / 10
                : 0,
            isActive: tank.deletedAt === null,
        };
    }
};
exports.MilkTankService = MilkTankService;
exports.MilkTankService = MilkTankService = MilkTankService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService])
], MilkTankService);
//# sourceMappingURL=milk-tank.service.js.map