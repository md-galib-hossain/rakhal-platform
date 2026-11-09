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
var EquipmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const medicine_status_1 = require("../../domain/medicine-status");
const inventory_activity_service_1 = require("./inventory-activity.service");
let EquipmentService = EquipmentService_1 = class EquipmentService {
    prisma;
    activity;
    log;
    constructor(prisma, logger, activity) {
        this.prisma = prisma;
        this.activity = activity;
        this.log = logger.setContext(EquipmentService_1.name);
    }
    async create(farmId, userId, dto) {
        try {
            const equipment = await this.prisma.equipment.create({
                data: {
                    farmId,
                    name: dto.name,
                    assetId: dto.assetId,
                    type: dto.type,
                    unitId: dto.unitId,
                    currentStock: dto.currentStock,
                    costPerUnit: dto.costPerUnit,
                    lowStockThreshold: dto.lowStockThreshold ?? 0,
                    purchaseDate: new Date(dto.purchaseDate),
                    notes: dto.notes,
                    createdBy: userId,
                },
                include: { unit: true },
            });
            this.log.info('Equipment created', { equipmentId: equipment.id, farmId });
            await this.activity.record(farmId, userId, 'Equipment Added', `Equipment "${equipment.name}" added — stock ${equipment.currentStock}${equipment.unit ? ` ${equipment.unit.symbol}` : ''}.`);
            return this.present(equipment);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Equipment item already exists');
            }
            throw error;
        }
    }
    async createCatalogRowInTx(farmId, userId, input, tx) {
        return tx.equipment.create({
            data: {
                farmId,
                name: input.name,
                assetId: input.assetId,
                type: input.type,
                unitId: input.unitId,
                currentStock: 0,
                costPerUnit: input.costPerUnit,
                lowStockThreshold: input.lowStockThreshold ?? 0,
                purchaseDate: input.purchaseDate,
                notes: input.notes,
                createdBy: userId,
            },
            select: { id: true },
        });
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.type ? { type: query.type } : {}),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { assetId: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.equipment.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            include: { unit: true },
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((equipment) => this.present(equipment)),
            meta: page.meta,
        };
    }
    async findOne(farmId, id) {
        return this.present(await this.getOrThrow(farmId, id));
    }
    async update(farmId, id, dto, userId) {
        await this.getOrThrow(farmId, id);
        try {
            const equipment = await this.prisma.equipment.update({
                where: { id },
                data: {
                    name: dto.name,
                    assetId: dto.assetId,
                    type: dto.type,
                    unitId: dto.unitId,
                    currentStock: dto.currentStock,
                    costPerUnit: dto.costPerUnit,
                    lowStockThreshold: dto.lowStockThreshold,
                    ...(dto.purchaseDate
                        ? { purchaseDate: new Date(dto.purchaseDate) }
                        : {}),
                    notes: dto.notes,
                },
                include: { unit: true },
            });
            this.log.info('Equipment updated', { equipmentId: id, farmId });
            await this.activity.record(farmId, userId, 'Equipment Updated', `Equipment "${equipment.name}" updated.`);
            return this.present(equipment);
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Equipment item already exists');
            }
            throw error;
        }
    }
    async archive(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const equipment = await this.prisma.equipment.update({
            where: { id },
            data: { deletedAt: new Date() },
            include: { unit: true },
        });
        this.log.info('Equipment archived', { equipmentId: id, farmId });
        await this.activity.record(farmId, userId, 'Equipment Archived', `Equipment "${equipment.name}" archived.`);
        return this.present(equipment);
    }
    async restore(farmId, id, userId) {
        await this.getOrThrow(farmId, id);
        const equipment = await this.prisma.equipment.update({
            where: { id },
            data: { deletedAt: null },
            include: { unit: true },
        });
        this.log.info('Equipment restored', { equipmentId: id, farmId });
        await this.activity.record(farmId, userId, 'Equipment Restored', `Equipment "${equipment.name}" restored.`);
        return this.present(equipment);
    }
    async remove(farmId, id, userId) {
        return this.archive(farmId, id, userId);
    }
    async adjustStock(farmId, userId, id, dto, tx) {
        const existing = await this.getOrThrow(farmId, id, tx ?? this.prisma);
        const balanceAfter = existing.currentStock + dto.adjustment;
        if (dto.adjustment === 0) {
            throw new common_1.BadRequestException('Adjustment must be non-zero');
        }
        if (balanceAfter < 0) {
            throw new common_1.BadRequestException('Stock cannot go below zero');
        }
        const write = async (client) => {
            const updatedEquipment = await client.equipment.update({
                where: { id },
                data: { currentStock: balanceAfter },
                include: { unit: true },
            });
            await client.equipmentStockMovement.create({
                data: {
                    equipmentId: id,
                    farmId,
                    reason: dto.reason,
                    delta: dto.adjustment,
                    balanceAfter,
                    notes: dto.notes,
                    saleLineId: dto.saleLineId ?? null,
                    createdBy: userId,
                },
            });
            return updatedEquipment;
        };
        const equipment = tx
            ? await write(tx)
            : await this.prisma.$transaction((t) => write(t));
        this.log.info('Equipment stock adjusted', {
            equipmentId: id,
            farmId,
            delta: dto.adjustment,
            balanceAfter,
        });
        return this.present(equipment);
    }
    async removeMany(farmId, ids, userId) {
        const result = await this.prisma.equipment.updateMany({
            where: { farmId, id: { in: ids }, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        this.log.info('Equipment bulk-archived', {
            farmId,
            requested: ids.length,
            archived: result.count,
        });
        if (result.count > 0) {
            await this.activity.record(farmId, userId, 'Equipment Bulk Archived', `${result.count} equipment item(s) archived.`);
        }
        return { deleted: result.count };
    }
    async getOrThrow(farmId, id, client = this.prisma) {
        const equipment = await client.equipment.findFirst({
            where: { id, farmId },
            include: { unit: true },
        });
        if (!equipment) {
            throw new common_1.NotFoundException('Equipment item not found');
        }
        return equipment;
    }
    present(equipment) {
        return {
            ...equipment,
            stockStatus: (0, medicine_status_1.computeStockStatus)(equipment.currentStock, equipment.lowStockThreshold),
        };
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.EquipmentService = EquipmentService;
exports.EquipmentService = EquipmentService = EquipmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        inventory_activity_service_1.InventoryActivityService])
], EquipmentService);
//# sourceMappingURL=equipment.service.js.map