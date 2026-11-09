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
var SemenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemenService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const inventory_activity_service_1 = require("./inventory-activity.service");
let SemenService = SemenService_1 = class SemenService {
    prisma;
    activity;
    log;
    constructor(prisma, logger, activity) {
        this.prisma = prisma;
        this.activity = activity;
        this.log = logger.setContext(SemenService_1.name);
    }
    async listTanks(farmId) {
        const tanks = await this.prisma.semenTank.findMany({
            where: { farmId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        const sums = await this.prisma.semenBatch.groupBy({
            by: ['tankId'],
            where: {
                farmId,
                deletedAt: null,
                tankId: { in: tanks.map((t) => t.id) },
            },
            _sum: { strawQuantity: true },
        });
        const byTank = new Map(sums.map((s) => [s.tankId, s._sum.strawQuantity ?? 0]));
        return tanks.map((tank) => this.presentTank(tank, byTank.get(tank.id) ?? 0));
    }
    async createTank(farmId, userId, dto) {
        const tank = await this.prisma.semenTank.create({
            data: {
                farmId,
                name: dto.name,
                modelManufacturer: dto.modelManufacturer,
                strawCapacity: dto.strawCapacity,
                numCanisters: dto.numCanisters,
                numGoblets: dto.numGoblets,
                storageLocation: dto.storageLocation,
                createdBy: userId,
            },
        });
        this.log.info('Semen tank created', { tankId: tank.id, farmId });
        await this.activity.record(farmId, userId, 'Semen Tank Added', `Semen tank "${tank.name}" added — capacity ${tank.strawCapacity} straws.`);
        return this.presentTank(tank, 0);
    }
    async updateTank(farmId, id, dto, userId) {
        await this.getTankOrThrow(farmId, id);
        const tank = await this.prisma.semenTank.update({
            where: { id },
            data: {
                name: dto.name,
                modelManufacturer: dto.modelManufacturer,
                strawCapacity: dto.strawCapacity,
                numCanisters: dto.numCanisters,
                numGoblets: dto.numGoblets,
                storageLocation: dto.storageLocation,
            },
        });
        this.log.info('Semen tank updated', { tankId: id, farmId });
        await this.activity.record(farmId, userId, 'Semen Tank Updated', `Semen tank "${tank.name}" updated.`);
        return this.presentTank(tank, await this.tankStrawTotal(farmId, id));
    }
    async archiveTank(farmId, id, userId) {
        await this.getTankOrThrow(farmId, id);
        const tank = await this.prisma.semenTank.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        await this.activity.record(farmId, userId, 'Semen Tank Archived', `Semen tank "${tank.name}" archived.`);
        return this.presentTank(tank, await this.tankStrawTotal(farmId, id));
    }
    async listBatches(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.tankId ? { tankId: query.tankId } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { bullId: { contains: query.search, mode: 'insensitive' } },
                        { breed: { contains: query.search, mode: 'insensitive' } },
                        { batchCode: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.semenBatch.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((batch) => this.presentBatch(batch)),
            meta: page.meta,
        };
    }
    async createBatch(farmId, userId, dto) {
        if (dto.tankId) {
            await this.assertTankCapacity(farmId, dto.tankId, dto.strawQuantity);
        }
        const { semenType, targetSex } = this.resolveSemenTypeFields(dto.semenType, dto.targetSex);
        const batch = await this.prisma.semenBatch.create({
            data: {
                farmId,
                name: dto.name,
                batchCode: dto.batchCode,
                bullId: dto.bullId,
                breed: dto.breed,
                strawColor: dto.strawColor,
                initialVitalityPct: dto.initialVitalityPct,
                strawQuantity: dto.strawQuantity,
                lowStrawThreshold: dto.lowStrawThreshold ?? 5,
                costPerUnit: dto.costPerUnit,
                semenType,
                targetSex,
                fatherId: dto.fatherId,
                motherId: dto.motherId,
                tankId: dto.tankId,
                canister: dto.canister,
                goblet: dto.goblet,
                notes: dto.notes,
                createdBy: userId,
            },
        });
        this.log.info('Semen batch created', { batchId: batch.id, farmId });
        await this.activity.record(farmId, userId, 'Semen Batch Added', `Semen batch "${batch.name}" added — ${batch.strawQuantity} straws.`);
        return this.presentBatch(batch);
    }
    async updateBatch(farmId, id, dto, userId) {
        const existing = await this.getBatchOrThrow(farmId, id);
        const tankId = dto.tankId ?? existing.tankId;
        const strawQuantity = dto.strawQuantity ?? existing.strawQuantity;
        if (tankId) {
            await this.assertTankCapacity(farmId, tankId, strawQuantity, id);
        }
        const { semenType, targetSex } = this.resolveSemenTypeFields(dto.semenType ?? existing.semenType ?? undefined, dto.targetSex ?? existing.targetSex ?? undefined);
        const batch = await this.prisma.semenBatch.update({
            where: { id },
            data: {
                name: dto.name,
                batchCode: dto.batchCode,
                bullId: dto.bullId,
                breed: dto.breed,
                strawColor: dto.strawColor,
                initialVitalityPct: dto.initialVitalityPct,
                strawQuantity: dto.strawQuantity,
                lowStrawThreshold: dto.lowStrawThreshold,
                costPerUnit: dto.costPerUnit,
                semenType,
                targetSex,
                tankId: dto.tankId,
                canister: dto.canister,
                goblet: dto.goblet,
                notes: dto.notes,
            },
        });
        this.log.info('Semen batch updated', { batchId: id, farmId });
        await this.activity.record(farmId, userId, 'Semen Batch Updated', `Semen batch "${batch.name}" updated.`);
        return this.presentBatch(batch);
    }
    async archiveBatch(farmId, id, userId) {
        await this.getBatchOrThrow(farmId, id);
        const batch = await this.prisma.semenBatch.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        await this.activity.record(farmId, userId, 'Semen Batch Archived', `Semen batch "${batch.name}" archived.`);
        return this.presentBatch(batch);
    }
    async decrementStraw(farmId, batchId, by = 1, actorId, sourceEventId) {
        const existing = await this.getBatchOrThrow(farmId, batchId);
        const next = existing.strawQuantity - by;
        if (next < 0) {
            throw new common_1.BadRequestException('Not enough straws in this batch');
        }
        const [batch] = await this.prisma.$transaction([
            this.prisma.semenBatch.update({
                where: { id: batchId },
                data: { strawQuantity: next },
            }),
            this.prisma.semenStrawMovement.create({
                data: {
                    batchId,
                    farmId,
                    reason: client_1.SemenStrawMovementReason.AI_USE,
                    delta: -by,
                    balanceAfter: next,
                    sourceEventId: sourceEventId ?? null,
                    createdBy: actorId ?? null,
                },
            }),
        ]);
        this.log.info('Semen straw decremented', { batchId, farmId, by });
        await this.activity.record(farmId, actorId ?? undefined, 'Semen Straw Used', `${by} straw${by === 1 ? '' : 's'} used from semen batch "${batch.name}" — ${existing.strawQuantity} to ${next} left.`);
        return this.presentBatch(batch);
    }
    async restoreStraw(farmId, batchId, by, reason, sourceEventId, actorId) {
        const existing = await this.getBatchOrThrow(farmId, batchId);
        const next = existing.strawQuantity + by;
        const [updated] = await this.prisma.$transaction([
            this.prisma.semenBatch.update({
                where: { id: batchId },
                data: { strawQuantity: next },
            }),
            this.prisma.semenStrawMovement.create({
                data: {
                    batchId,
                    farmId,
                    reason: client_1.SemenStrawMovementReason.REVERSAL,
                    delta: by,
                    balanceAfter: next,
                    notes: reason ?? null,
                    sourceEventId: sourceEventId ?? null,
                    createdBy: actorId ?? null,
                },
            }),
        ]);
        this.log.info('Semen straw restored', { batchId, farmId, by });
        await this.activity.record(farmId, actorId ?? undefined, 'Semen Straw Restored', `${by} straw${by === 1 ? '' : 's'} restored to semen batch "${updated.name}" — ${existing.strawQuantity} to ${next} in stock${reason ? ` (${reason})` : ''}.`);
        return {
            batch: this.presentBatch(updated),
            warning: !existing.deletedAt
                ? null
                : 'This batch is archived — the straw count was restored, but the physical straw cannot be un-thawed.',
        };
    }
    async getTankOrThrow(farmId, id) {
        const tank = await this.prisma.semenTank.findFirst({
            where: { id, farmId },
        });
        if (!tank)
            throw new common_1.NotFoundException('Semen tank not found');
        return tank;
    }
    async getBatchOrThrow(farmId, id) {
        const batch = await this.prisma.semenBatch.findFirst({
            where: { id, farmId },
        });
        if (!batch)
            throw new common_1.NotFoundException('Semen batch not found');
        return batch;
    }
    async tankStrawTotal(farmId, tankId) {
        const sum = await this.prisma.semenBatch.aggregate({
            where: { farmId, tankId, deletedAt: null },
            _sum: { strawQuantity: true },
        });
        return sum._sum.strawQuantity ?? 0;
    }
    async assertTankCapacity(farmId, tankId, incomingStraws, excludeBatchId) {
        const tank = await this.getTankOrThrow(farmId, tankId);
        const sum = await this.prisma.semenBatch.aggregate({
            where: {
                farmId,
                tankId,
                deletedAt: null,
                ...(excludeBatchId ? { id: { not: excludeBatchId } } : {}),
            },
            _sum: { strawQuantity: true },
        });
        const others = sum._sum.strawQuantity ?? 0;
        if (others + incomingStraws > tank.strawCapacity) {
            throw new common_1.ConflictException(`Tank capacity exceeded (${others + incomingStraws}/${tank.strawCapacity} straws)`);
        }
    }
    resolveSemenTypeFields(semenType, targetSex) {
        return {
            semenType: semenType ?? null,
            targetSex: semenType === client_1.SemenType.SEX_SORTED ? (targetSex ?? null) : null,
        };
    }
    presentTank(tank, strawInStock) {
        return {
            ...tank,
            strawInStock,
            availableCapacity: Math.max(tank.strawCapacity - strawInStock, 0),
        };
    }
    presentBatch(batch) {
        return {
            ...batch,
            lowStraw: batch.strawQuantity <= batch.lowStrawThreshold,
        };
    }
};
exports.SemenService = SemenService;
exports.SemenService = SemenService = SemenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService])
], SemenService);
//# sourceMappingURL=semen.service.js.map