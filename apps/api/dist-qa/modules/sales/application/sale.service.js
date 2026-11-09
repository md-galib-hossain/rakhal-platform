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
var SaleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const receivable_status_1 = require("src/modules/finance-v2/receivables/domain/receivable-status");
const sale_line_shape_1 = require("../domain/sale-line-shape");
const sale_number_allocator_1 = require("../infrastructure/sale-number.allocator");
const SALE_INCLUDE = {
    lines: {
        include: {
            unit: true,
            milkDetail: true,
            animalDetail: true,
            inventoryDetail: true,
            manureDetail: true,
        },
    },
};
function deriveSalePaymentStatus(receivable, allocated, outstanding) {
    if (!receivable) {
        return receivable_status_1.ReceivableStatus.PAID;
    }
    if (receivable.closedAt) {
        return receivable_status_1.ReceivableStatus.PAID;
    }
    let status;
    if ((0, money_1.isZero)(allocated)) {
        status = receivable_status_1.ReceivableStatus.UNPAID;
    }
    else if ((0, money_1.gte)(allocated, receivable.totalAmount)) {
        status = receivable_status_1.ReceivableStatus.PAID;
    }
    else {
        status = receivable_status_1.ReceivableStatus.PARTIALLY_PAID;
    }
    if (status !== receivable_status_1.ReceivableStatus.PAID &&
        receivable.dueDate &&
        receivable.dueDate.getTime() < Date.now() &&
        !(0, money_1.isZero)(outstanding)) {
        status = receivable_status_1.ReceivableStatus.OVERDUE;
    }
    return status;
}
function buildPaymentStatusWhere(status) {
    const now = new Date();
    const notOverdue = {
        OR: [
            { receivable: { dueDate: null } },
            { receivable: { dueDate: { gte: now } } },
        ],
    };
    switch (status) {
        case receivable_status_1.ReceivableStatus.PAID:
            return {
                OR: [{ receivable: null }, { receivable: { closedAt: { not: null } } }],
            };
        case receivable_status_1.ReceivableStatus.UNPAID:
            return {
                AND: [
                    { receivable: { isNot: null } },
                    { receivable: { closedAt: null } },
                    { receivable: { allocations: { none: {} } } },
                    notOverdue,
                ],
            };
        case receivable_status_1.ReceivableStatus.PARTIALLY_PAID:
            return {
                AND: [
                    { receivable: { isNot: null } },
                    { receivable: { closedAt: null } },
                    { receivable: { allocations: { some: {} } } },
                    notOverdue,
                ],
            };
        case receivable_status_1.ReceivableStatus.OVERDUE:
            return {
                AND: [
                    { receivable: { isNot: null } },
                    { receivable: { closedAt: null } },
                    { receivable: { dueDate: { lt: now } } },
                ],
            };
    }
}
let SaleService = SaleService_1 = class SaleService {
    prisma;
    saleNumberAllocator;
    log;
    constructor(prisma, saleNumberAllocator, logger) {
        this.prisma = prisma;
        this.saleNumberAllocator = saleNumberAllocator;
        this.log = logger.setContext(SaleService_1.name);
    }
    async createSale(farmId, userId, dto, tx) {
        const run = (client) => this.createWithClient(client, farmId, userId, dto);
        return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
    }
    async createWithClient(client, farmId, userId, dto) {
        for (const line of dto.lines) {
            const error = (0, sale_line_shape_1.validateSaleLineDetailShape)(line);
            if (error) {
                throw new common_1.BadRequestException(error);
            }
        }
        const lineComputations = dto.lines.map((line) => ({
            line,
            totalAmount: (0, money_1.toStorage)((0, money_1.multiply)(line.quantity, line.unitPrice)),
        }));
        const subtotal = (0, money_1.toStorage)((0, money_1.sum)(lineComputations.map((c) => c.totalAmount)));
        const discountAmount = (0, money_1.toStorage)(dto.discountAmount ?? 0);
        const totalAmount = (0, money_1.clampNonNegative)((0, money_1.subtract)(subtotal, discountAmount));
        if (dto.customerId) {
            await this.assertCustomerBelongsToFarm(client, farmId, dto.customerId);
        }
        const saleNumber = await this.saleNumberAllocator.allocate(client, farmId);
        const sale = await client.sale.create({
            data: {
                farmId,
                saleNumber,
                customerId: dto.customerId ?? null,
                saleDate: new Date(dto.saleDate),
                subtotal,
                discountAmount,
                totalAmount,
                status: client_1.SaleStatus.DRAFT,
                notes: dto.notes ?? null,
                createdById: userId,
            },
        });
        for (const { line, totalAmount: lineTotal } of lineComputations) {
            const saleLine = await client.saleLine.create({
                data: {
                    saleId: sale.id,
                    type: line.type,
                    description: line.description,
                    quantity: (0, money_1.toStorage)(line.quantity),
                    unitId: line.unitId ?? null,
                    unitPrice: (0, money_1.toStorage)(line.unitPrice),
                    totalAmount: lineTotal,
                },
            });
            await this.createLineDetail(client, farmId, saleLine.id, line);
        }
        this.log.info('Sale created', {
            farmId,
            saleId: sale.id,
            saleNumber,
            lineCount: dto.lines.length,
            totalAmount: totalAmount.toString(),
        });
        return this.getOrThrow(client, farmId, sale.id);
    }
    async createLineDetail(client, farmId, saleLineId, line) {
        switch (line.type) {
            case client_1.SaleLineType.MILK:
                await client.milkSaleLine.create({ data: { saleLineId } });
                return;
            case client_1.SaleLineType.ANIMAL: {
                const cattle = await client.cattle.findFirst({
                    where: { id: line.cattleId, farmId },
                    select: { id: true },
                });
                if (!cattle) {
                    throw new common_1.NotFoundException('Cattle not found for ANIMAL sale line');
                }
                await client.animalSaleLine.create({
                    data: { saleLineId, cattleId: cattle.id },
                });
                return;
            }
            case client_1.SaleLineType.INVENTORY: {
                if (line.medicineId) {
                    const medicine = await client.medicine.findFirst({
                        where: { id: line.medicineId, farmId },
                        select: { id: true },
                    });
                    if (!medicine) {
                        throw new common_1.NotFoundException('Medicine not found for INVENTORY sale line');
                    }
                }
                else if (line.feedItemId) {
                    const feedItem = await client.feedItem.findFirst({
                        where: { id: line.feedItemId, farmId },
                        select: { id: true },
                    });
                    if (!feedItem) {
                        throw new common_1.NotFoundException('Feed item not found for INVENTORY sale line');
                    }
                }
                else if (line.equipmentId) {
                    const equipment = await client.equipment.findFirst({
                        where: { id: line.equipmentId, farmId },
                        select: { id: true },
                    });
                    if (!equipment) {
                        throw new common_1.NotFoundException('Equipment not found for INVENTORY sale line');
                    }
                }
                await client.inventorySaleLine.create({
                    data: {
                        saleLineId,
                        medicineId: line.medicineId ?? null,
                        feedItemId: line.feedItemId ?? null,
                        equipmentId: line.equipmentId ?? null,
                    },
                });
                return;
            }
            case client_1.SaleLineType.MANURE:
                await client.manureSaleLine.create({
                    data: { saleLineId, notes: line.manureNotes ?? null },
                });
        }
    }
    async findOne(farmId, id) {
        return this.getOrThrow(this.prisma, farmId, id);
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            status: query.status ??
                (query.includeDrafts ? undefined : { not: client_1.SaleStatus.DRAFT }),
            ...(query.customerId ? { customerId: query.customerId } : {}),
            ...(query.from || query.to
                ? {
                    saleDate: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
            ...(query.lineType ? { lines: { some: { type: query.lineType } } } : {}),
            ...(query.q
                ? {
                    OR: [
                        { saleNumber: { contains: query.q, mode: 'insensitive' } },
                        {
                            lines: {
                                some: {
                                    description: { contains: query.q, mode: 'insensitive' },
                                },
                            },
                        },
                    ],
                }
                : {}),
            ...(query.paymentStatus
                ? buildPaymentStatusWhere(query.paymentStatus)
                : {}),
        };
        const rows = await this.prisma.sale.findMany({
            where,
            orderBy: [{ saleDate: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: {
                customer: { select: { id: true, name: true } },
                lines: { select: { type: true, description: true, quantity: true } },
                receivable: {
                    select: {
                        id: true,
                        totalAmount: true,
                        dueDate: true,
                        closedAt: true,
                    },
                },
            },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        if (page.items.length === 0) {
            return { items: [], meta: page.meta };
        }
        const receivableIds = page.items
            .map((s) => s.receivable?.id)
            .filter((id) => id != null);
        const sums = receivableIds.length
            ? await this.prisma.paymentAllocation.groupBy({
                by: ['receivableId'],
                where: { receivableId: { in: receivableIds } },
                _sum: { amount: true },
            })
            : [];
        const allocatedByReceivableId = new Map(sums.map((s) => [s.receivableId, s._sum.amount ?? 0]));
        const items = page.items.map((sale) => this.toListRow(sale, allocatedByReceivableId));
        return { items, meta: page.meta };
    }
    toListRow(sale, allocatedByReceivableId) {
        const receivable = sale.receivable;
        const allocated = receivable
            ? (0, money_1.toStorage)(allocatedByReceivableId.get(receivable.id) ?? 0)
            : (0, money_1.toStorage)(0);
        const paidAmount = receivable ? allocated : (0, money_1.toStorage)(sale.totalAmount);
        const dueAmount = receivable && !receivable.closedAt
            ? (0, money_1.clampNonNegative)((0, money_1.subtract)(receivable.totalAmount, allocated))
            : (0, money_1.toStorage)(0);
        const paymentStatus = deriveSalePaymentStatus(receivable, allocated, dueAmount);
        const first = sale.lines[0];
        const totalQuantity = sale.lines.reduce((s, l) => s + Number(l.quantity), 0);
        return {
            id: sale.id,
            saleNumber: sale.saleNumber,
            saleDate: sale.saleDate,
            status: sale.status,
            customer: sale.customer
                ? { id: sale.customer.id, name: sale.customer.name }
                : null,
            totalAmount: sale.totalAmount.toString(),
            paidAmount: paidAmount.toString(),
            dueAmount: dueAmount.toString(),
            paymentStatus,
            dueDate: receivable?.dueDate ?? null,
            lineSummary: {
                type: first?.type ?? null,
                description: sale.lines.length > 1
                    ? `${sale.lines.length} items`
                    : (first?.description ?? null),
                quantity: totalQuantity,
            },
        };
    }
    async assertCustomerBelongsToFarm(client, farmId, customerId) {
        const buyer = await client.milkBuyer.findFirst({
            where: { id: customerId, farmId },
            select: { id: true },
        });
        if (!buyer) {
            throw new common_1.BadRequestException('customerId not found for this farm');
        }
    }
    async getOrThrow(client, farmId, id) {
        const sale = await client.sale.findFirst({
            where: { id, farmId },
            include: SALE_INCLUDE,
        });
        if (!sale) {
            throw new common_1.NotFoundException('Sale not found');
        }
        return sale;
    }
};
exports.SaleService = SaleService;
exports.SaleService = SaleService = SaleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_number_allocator_1.SaleNumberAllocator,
        logger_service_1.LoggerService])
], SaleService);
//# sourceMappingURL=sale.service.js.map