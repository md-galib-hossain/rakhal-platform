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
var BuyerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const pagination_1 = require("src/common/pagination");
const money_1 = require("src/common/money");
const sell_milk_use_case_1 = require("src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case");
const void_sale_use_case_1 = require("src/modules/sales/application/use-cases/void-sale/void-sale.use-case");
const milk_price_1 = require("../../domain/milk-price");
const dispatch_status_1 = require("../../domain/dispatch-status");
const dispatch_number_allocator_1 = require("../../infrastructure/dispatch-number.allocator");
const DAY_MS = 24 * 60 * 60 * 1000;
function buildDispatchStatusWhere(status) {
    switch (status) {
        case 'CANCELLED':
            return { cancelledAt: { not: null } };
        case 'PENDING':
            return { cancelledAt: null, volumeReceivedL: null };
        case 'DELIVERED':
            return { cancelledAt: null, volumeReceivedL: { not: null } };
        default:
            return {};
    }
}
let BuyerService = BuyerService_1 = class BuyerService {
    prisma;
    sellMilkUseCase;
    voidSaleUseCase;
    dispatchNumberAllocator;
    activityLog;
    log;
    constructor(prisma, sellMilkUseCase, voidSaleUseCase, dispatchNumberAllocator, activityLog, logger) {
        this.prisma = prisma;
        this.sellMilkUseCase = sellMilkUseCase;
        this.voidSaleUseCase = voidSaleUseCase;
        this.dispatchNumberAllocator = dispatchNumberAllocator;
        this.activityLog = activityLog;
        this.log = logger.setContext(BuyerService_1.name);
    }
    async recordActivity(farmId, userId, eventTitle, actionDetails, financialImpact) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle,
                actionDetails,
                actorId: userId,
                ...(financialImpact !== undefined ? { financialImpact } : {}),
            });
        }
        catch (error) {
            this.log.error('Buyer activity log failed', {
                farmId,
                eventTitle,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async createBuyer(farmId, userId, dto) {
        const buyer = await this.prisma.milkBuyer.create({
            data: {
                farmId,
                name: dto.name,
                contactPerson: dto.contactPerson,
                phone: dto.phone,
                email: dto.email,
                buyerType: dto.buyerType,
                paymentTermsDays: dto.paymentTermsDays ?? 0,
                basePricePerLitre: dto.basePricePerLitre,
                baseFatPct: dto.baseFatPct ?? 3.5,
                fatBonusPer01Pct: dto.fatBonusPer01Pct ?? 0,
                sccThreshold: dto.sccThreshold ?? 200_000,
                sccPenaltyPer100k: dto.sccPenaltyPer100k ?? 0,
                collectionDays: dto.collectionDays ?? [],
                collectionTime: dto.collectionTime,
                bankDetails: dto.bankDetails,
                createdBy: userId,
            },
        });
        this.log.info('Milk buyer created', { buyerId: buyer.id, farmId });
        await this.recordActivity(farmId, userId, 'Buyer Added', `Buyer "${buyer.name}" added (৳${buyer.basePricePerLitre}/L, ${buyer.paymentTermsDays}-day terms).`);
        return buyer;
    }
    async listBuyers(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.search
                ? {
                    OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        {
                            contactPerson: { contains: query.search, mode: 'insensitive' },
                        },
                        { phone: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.milkBuyer.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        if (page.items.length === 0) {
            return { items: [], meta: page.meta };
        }
        const [purchaseAgg, outstanding] = await Promise.all([
            this.purchaseAggByCustomer(farmId),
            this.receivableOutstandingByCustomer(farmId),
        ]);
        const purchaseById = new Map(purchaseAgg.map((r) => [r.customerId, r]));
        const outstandingById = new Map(outstanding.map((r) => [r.customer_id, r.outstanding]));
        const items = page.items.map((buyer) => {
            const purchase = purchaseById.get(buyer.id);
            return {
                ...buyer,
                totalPurchased: (0, money_1.toStorage)(purchase?.totalAmount ?? 0).toString(),
                lastPurchaseAt: purchase?.lastSaleAt?.toISOString() ?? null,
                outstanding: (0, money_1.toStorage)(outstandingById.get(buyer.id) ?? 0).toString(),
                status: !buyer.deletedAt ? 'ACTIVE' : 'INACTIVE',
            };
        });
        return { items, meta: page.meta };
    }
    async getBuyersSummary(farmId) {
        const [totalBuyers, activeBuyers, purchaseAgg, outstanding] = await Promise.all([
            this.prisma.milkBuyer.count({ where: { farmId } }),
            this.prisma.milkBuyer.count({ where: { farmId, deletedAt: null } }),
            this.purchaseAggByCustomer(farmId),
            this.receivableOutstandingByCustomer(farmId),
        ]);
        const totalSales = purchaseAgg.reduce((sum, r) => sum.plus((0, money_1.toStorage)(r.totalAmount ?? 0)), (0, money_1.toStorage)(0));
        const totalOutstanding = outstanding.reduce((sum, r) => sum.plus((0, money_1.toStorage)(r.outstanding ?? 0)), (0, money_1.toStorage)(0));
        return {
            totalBuyers,
            activeBuyers,
            totalSales: totalSales.toString(),
            totalOutstanding: totalOutstanding.toString(),
        };
    }
    async getBuyerOverview(farmId, id) {
        const buyer = await this.getBuyerOrThrow(farmId, id);
        const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
        const [thisYearAgg, outstandingRows, lastPaymentRows, recentInvoices] = await Promise.all([
            this.prisma.sale.aggregate({
                where: { farmId, customerId: id, saleDate: { gte: yearStart } },
                _sum: { totalAmount: true },
            }),
            this.receivableOutstandingByCustomer(farmId, id),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT p."amount"::text AS amount, p."transactionDate" AS date
        FROM "PaymentAllocation" pa
        JOIN "FinancePayment" p ON p.id = pa."paymentId"
        JOIN "Receivable" r ON r.id = pa."receivableId"
        WHERE r."customerId" = ${id} AND r."farmId" = ${farmId}
        ORDER BY p."transactionDate" DESC
        LIMIT 1
      `),
            this.prisma.sale.findMany({
                where: { farmId, customerId: id },
                orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
                take: 5,
                select: {
                    id: true,
                    saleNumber: true,
                    saleDate: true,
                    totalAmount: true,
                    status: true,
                },
            }),
        ]);
        const lastPayment = lastPaymentRows[0]
            ? {
                amount: (0, money_1.toStorage)(lastPaymentRows[0].amount).toString(),
                date: lastPaymentRows[0].date.toISOString(),
            }
            : null;
        return {
            outstandingAmount: (0, money_1.toStorage)(outstandingRows[0]?.outstanding ?? 0).toString(),
            totalPurchasedThisYear: (0, money_1.toStorage)(thisYearAgg._sum.totalAmount ?? 0).toString(),
            lastPayment,
            recentInvoices: recentInvoices.map((s) => ({
                id: s.id,
                saleNumber: s.saleNumber,
                saleDate: s.saleDate.toISOString(),
                totalAmount: (0, money_1.toStorage)(s.totalAmount).toString(),
                status: s.status,
            })),
            info: {
                phone: buyer.phone,
                address: null,
                paymentTermsDays: buyer.paymentTermsDays,
                basePricePerLitre: buyer.basePricePerLitre,
                buyerType: buyer.buyerType,
            },
        };
    }
    async getBuyerGroups(farmId) {
        const [buyers, purchaseAgg] = await Promise.all([
            this.prisma.milkBuyer.findMany({
                where: { farmId },
                select: { id: true, buyerType: true },
            }),
            this.purchaseAggByCustomer(farmId),
        ]);
        const purchaseById = new Map(purchaseAgg.map((r) => [r.customerId, r]));
        const totals = new Map();
        for (const buyer of buyers) {
            const entry = totals.get(buyer.buyerType) ?? {
                buyerCount: 0,
                totalSales: (0, money_1.toStorage)(0),
            };
            entry.buyerCount += 1;
            entry.totalSales = entry.totalSales.plus((0, money_1.toStorage)(purchaseById.get(buyer.id)?.totalAmount ?? 0));
            totals.set(buyer.buyerType, entry);
        }
        return Object.values(client_1.BuyerType).map((buyerType) => {
            const entry = totals.get(buyerType);
            return {
                buyerType,
                buyerCount: entry?.buyerCount ?? 0,
                totalSales: (entry?.totalSales ?? (0, money_1.toStorage)(0)).toString(),
            };
        });
    }
    async purchaseAggByCustomer(farmId) {
        const rows = await this.prisma.sale.groupBy({
            by: ['customerId'],
            where: { farmId, customerId: { not: null } },
            _sum: { totalAmount: true },
            _max: { saleDate: true },
        });
        return rows.map((r) => ({
            customerId: r.customerId,
            totalAmount: r._sum.totalAmount?.toString() ?? null,
            lastSaleAt: r._max.saleDate,
        }));
    }
    async receivableOutstandingByCustomer(farmId, customerId) {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH allocation_sums AS (
        SELECT "receivableId" AS doc_id, SUM(amount) AS allocated
        FROM "PaymentAllocation"
        WHERE "receivableId" IS NOT NULL
        GROUP BY "receivableId"
      )
      SELECT
        d."customerId" AS customer_id,
        SUM(d."totalAmount" - COALESCE(a.allocated, 0))::text AS outstanding
      FROM "Receivable" d
      LEFT JOIN allocation_sums a ON a.doc_id = d.id
      WHERE d."farmId" = ${farmId} AND d."customerId" IS NOT NULL
        ${customerId ? client_1.Prisma.sql `AND d."customerId" = ${customerId}` : client_1.Prisma.empty}
      GROUP BY d."customerId"
    `);
    }
    async getBuyer(farmId, id) {
        return this.getBuyerOrThrow(farmId, id);
    }
    async updateBuyer(farmId, userId, id, dto) {
        await this.getBuyerOrThrow(farmId, id);
        const buyer = await this.prisma.milkBuyer.update({
            where: { id },
            data: {
                name: dto.name,
                contactPerson: dto.contactPerson,
                phone: dto.phone,
                email: dto.email,
                buyerType: dto.buyerType,
                paymentTermsDays: dto.paymentTermsDays,
                basePricePerLitre: dto.basePricePerLitre,
                baseFatPct: dto.baseFatPct,
                fatBonusPer01Pct: dto.fatBonusPer01Pct,
                sccThreshold: dto.sccThreshold,
                sccPenaltyPer100k: dto.sccPenaltyPer100k,
                collectionDays: dto.collectionDays,
                collectionTime: dto.collectionTime,
                bankDetails: dto.bankDetails,
            },
        });
        this.log.info('Milk buyer updated', { buyerId: id, farmId });
        await this.recordActivity(farmId, userId, 'Buyer Updated', `Buyer "${buyer.name}" updated.`);
        return buyer;
    }
    async deactivateBuyer(farmId, userId, id) {
        await this.getBuyerOrThrow(farmId, id);
        const buyer = await this.prisma.milkBuyer.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Milk buyer deactivated', { buyerId: id, farmId });
        await this.recordActivity(farmId, userId, 'Buyer Deactivated', `Buyer "${buyer.name}" deactivated.`);
        return buyer;
    }
    async recordDispatch(farmId, userId, dto) {
        const buyer = await this.getBuyerOrThrow(farmId, dto.buyerId, {
            requireActive: true,
        });
        const dispatchedAt = new Date(dto.dispatchedAt);
        const pricedVolume = dto.volumeReceivedL ?? dto.volumeDispatchedL;
        const breakdown = (0, milk_price_1.computeMilkPrice)({
            volumeL: pricedVolume,
            basePricePerLitre: buyer.basePricePerLitre,
            fatPct: dto.fatPct ?? null,
            baseFatPct: buyer.baseFatPct,
            fatBonusPer01Pct: buyer.fatBonusPer01Pct,
            scc: dto.scc ?? null,
            sccThreshold: buyer.sccThreshold,
            sccPenaltyPer100k: buyer.sccPenaltyPer100k,
        });
        const discrepancyL = dto.volumeReceivedL == null
            ? null
            : Math.round((dto.volumeDispatchedL - dto.volumeReceivedL) * 100) / 100;
        const discrepancyFlagged = discrepancyL != null && discrepancyL !== 0;
        const paymentDueDate = buyer.paymentTermsDays > 0
            ? new Date(dispatchedAt.getTime() + buyer.paymentTermsDays * DAY_MS)
            : null;
        const effectivePricePerLitre = dto.volumeDispatchedL > 0 ? breakdown.total / dto.volumeDispatchedL : 0;
        const { dispatch, tankUpdated, saleId } = await this.prisma.$transaction(async (tx) => {
            const dispatchNumber = await this.dispatchNumberAllocator.allocate(tx, farmId);
            const dispatch = await tx.milkDispatch.create({
                data: {
                    farmId,
                    buyerId: buyer.id,
                    dispatchNumber,
                    dispatchedAt,
                    volumeDispatchedL: dto.volumeDispatchedL,
                    volumeReceivedL: dto.volumeReceivedL,
                    fatPct: dto.fatPct,
                    scc: dto.scc,
                    discrepancyL,
                    discrepancyFlagged,
                    basePricePerLitre: buyer.basePricePerLitre,
                    fatBonus: breakdown.fatBonus,
                    sccPenalty: breakdown.sccPenalty,
                    calculatedAmount: breakdown.total,
                    paymentDueDate,
                    notes: dto.notes,
                    driverName: dto.driverName,
                    createdBy: userId,
                },
            });
            let tankUpdated = false;
            let saleId = null;
            if (dto.volumeDispatchedL > 0) {
                const result = await this.sellMilkUseCase.execute(farmId, userId, {
                    volumeL: dto.volumeDispatchedL,
                    pricePerLitre: effectivePricePerLitre,
                    customerId: buyer.id,
                    saleDate: dispatchedAt.toISOString(),
                    description: `Milk dispatch to ${buyer.name}`,
                    notes: `Milk dispatch ${dispatch.id}`,
                    dueDate: paymentDueDate,
                    amountReceived: dto.amountReceived,
                    paymentMethod: dto.paymentMethod,
                    financialAccountId: dto.financialAccountId,
                    referenceNumber: dto.referenceNumber,
                }, tx);
                tankUpdated = result.tankUpdated;
                saleId = result.sale.id;
                await tx.milkDispatch.update({
                    where: { id: dispatch.id },
                    data: { saleId },
                });
            }
            return { dispatch, tankUpdated, saleId };
        });
        this.log.info('Milk dispatch recorded', {
            dispatchId: dispatch.id,
            farmId,
            buyerId: buyer.id,
            amount: breakdown.total,
            saleId,
        });
        return {
            id: dispatch.id,
            dispatchNumber: dispatch.dispatchNumber,
            buyerName: buyer.name,
            driverName: dispatch.driverName,
            volumeDispatchedL: dispatch.volumeDispatchedL,
            volumeReceivedL: dispatch.volumeReceivedL,
            discrepancyL,
            discrepancyFlagged,
            calculatedAmount: breakdown.total,
            priceBreakdown: breakdown,
            paymentDueDate,
            amountReceived: dto.amountReceived ?? 0,
            tankUpdated,
            saleId,
            status: (0, dispatch_status_1.deriveDispatchStatus)(dispatch),
        };
    }
    async listDispatches(farmId, query) {
        const where = {
            farmId,
            ...(query.buyerId ? { buyerId: query.buyerId } : {}),
            ...(query.from || query.to
                ? {
                    dispatchedAt: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
            ...buildDispatchStatusWhere(query.status),
        };
        const rows = await this.prisma.milkDispatch.findMany({
            where,
            orderBy: [{ dispatchedAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            include: { buyer: { select: { id: true, name: true } } },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            ...page,
            items: page.items.map((d) => ({
                ...d,
                status: (0, dispatch_status_1.deriveDispatchStatus)(d),
            })),
        };
    }
    async cancelDispatch(farmId, userId, dispatchId) {
        const dispatch = await this.prisma.milkDispatch.findFirst({
            where: { id: dispatchId, farmId },
        });
        if (!dispatch) {
            throw new common_1.NotFoundException('Dispatch not found');
        }
        if (dispatch.cancelledAt) {
            throw new common_1.BadRequestException('Dispatch is already cancelled');
        }
        await this.prisma.$transaction(async (tx) => {
            if (dispatch.saleId) {
                await this.voidSaleUseCase.cancelSale(farmId, userId, dispatch.saleId, tx);
            }
            await tx.milkDispatch.update({
                where: { id: dispatchId },
                data: { cancelledAt: new Date() },
            });
        });
        this.log.info('Dispatch cancelled', {
            farmId,
            dispatchId,
            cascadedSaleId: dispatch.saleId,
        });
        const reversed = dispatch.saleId
            ? await this.prisma.sale.findFirst({
                where: { id: dispatch.saleId, farmId },
                select: { totalAmount: true },
            })
            : null;
        await this.recordActivity(farmId, userId, 'Milk Dispatch Cancelled', `Dispatch ${dispatch.dispatchNumber} (${dispatch.volumeDispatchedL}L) cancelled${dispatch.saleId ? ' — sale reversed and milk returned to stock' : ''}.`, reversed ? -Number(reversed.totalAmount) : undefined);
        const updated = await this.prisma.milkDispatch.findFirstOrThrow({
            where: { id: dispatchId, farmId },
        });
        return { ...updated, status: (0, dispatch_status_1.deriveDispatchStatus)(updated) };
    }
    async recordReceipt(farmId, userId, dispatchId, dto) {
        const dispatch = await this.prisma.milkDispatch.findFirst({
            where: { id: dispatchId, farmId },
        });
        if (!dispatch) {
            throw new common_1.NotFoundException('Dispatch not found');
        }
        if (dispatch.cancelledAt) {
            throw new common_1.BadRequestException('Dispatch is cancelled — receipt cannot be recorded');
        }
        const discrepancyL = Math.round((dispatch.volumeDispatchedL - dto.volumeReceivedL) * 100) /
            100;
        const updated = await this.prisma.milkDispatch.update({
            where: { id: dispatchId },
            data: {
                volumeReceivedL: dto.volumeReceivedL,
                discrepancyL,
                discrepancyFlagged: discrepancyL !== 0,
                ...(dto.driverName !== undefined ? { driverName: dto.driverName } : {}),
            },
        });
        this.log.info('Dispatch receipt recorded', {
            farmId,
            dispatchId,
            volumeReceivedL: dto.volumeReceivedL,
            discrepancyL,
        });
        await this.recordActivity(farmId, userId, 'Milk Receipt Confirmed', `Dispatch ${dispatch.dispatchNumber}: buyer received ${dto.volumeReceivedL}L of ${dispatch.volumeDispatchedL}L${discrepancyL !== 0 ? ` (${discrepancyL}L discrepancy)` : ''}.`);
        return { ...updated, status: (0, dispatch_status_1.deriveDispatchStatus)(updated) };
    }
    async getDispatchesSummary(farmId) {
        const rows = await this.prisma.milkDispatch.findMany({
            where: { farmId },
            select: { cancelledAt: true, volumeReceivedL: true },
        });
        const counts = {
            total: rows.length,
            delivered: 0,
            inTransit: 0,
            cancelled: 0,
        };
        for (const row of rows) {
            const status = (0, dispatch_status_1.deriveDispatchStatus)(row);
            if (status === 'DELIVERED')
                counts.delivered += 1;
            else if (status === 'PENDING')
                counts.inTransit += 1;
            else
                counts.cancelled += 1;
        }
        const pct = (n) => counts.total > 0 ? Math.round((n / counts.total) * 1000) / 10 : 0;
        return {
            total: counts.total,
            delivered: { count: counts.delivered, pct: pct(counts.delivered) },
            inTransit: { count: counts.inTransit, pct: pct(counts.inTransit) },
            cancelled: { count: counts.cancelled, pct: pct(counts.cancelled) },
        };
    }
    async statement(farmId, buyerId, query) {
        const buyer = await this.getBuyerOrThrow(farmId, buyerId);
        const [year, month] = query.month.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        const dispatches = await this.prisma.milkDispatch.findMany({
            where: {
                farmId,
                buyerId,
                cancelledAt: null,
                dispatchedAt: { gte: start, lt: end },
            },
            orderBy: { dispatchedAt: 'asc' },
        });
        const round2 = (n) => Math.round(n * 100) / 100;
        const totalDispatchedL = round2(dispatches.reduce((s, d) => s + d.volumeDispatchedL, 0));
        const totalReceivedL = round2(dispatches.reduce((s, d) => s + (d.volumeReceivedL ?? d.volumeDispatchedL), 0));
        const qualityAdjustments = round2(dispatches.reduce((s, d) => s + d.fatBonus - d.sccPenalty, 0));
        const totalDue = round2(dispatches.reduce((s, d) => s + d.calculatedAmount, 0));
        const saleIds = dispatches
            .map((d) => d.saleId)
            .filter((id) => id != null);
        const v2Receivables = saleIds.length
            ? await this.prisma.receivable.findMany({
                where: { farmId, saleId: { in: saleIds } },
                select: { saleId: true, id: true },
            })
            : [];
        const v2ReceivableIdBySale = new Map(v2Receivables.map((r) => [r.saleId, r.id]));
        const v2Allocations = v2Receivables.length
            ? await this.prisma.paymentAllocation.groupBy({
                by: ['receivableId'],
                where: { receivableId: { in: v2Receivables.map((r) => r.id) } },
                _sum: { amount: true },
            })
            : [];
        const v2PaidByReceivable = new Map(v2Allocations.map((a) => [a.receivableId, a._sum.amount ?? 0]));
        const totalPaid = round2(dispatches.reduce((s, d) => {
            if (d.saleId) {
                const receivableId = v2ReceivableIdBySale.get(d.saleId);
                const paid = receivableId
                    ? Number(v2PaidByReceivable.get(receivableId) ?? 0)
                    : 0;
                return s + paid;
            }
            return s + d.paidAmount;
        }, 0));
        const baseAmount = round2(totalDue - qualityAdjustments);
        return {
            buyer: { id: buyer.id, name: buyer.name },
            month: query.month,
            totalDispatchedL,
            totalReceivedL,
            baseAmount,
            qualityAdjustments,
            totalDue,
            totalPaid,
            outstanding: round2(totalDue - totalPaid),
            dispatches,
        };
    }
    async getBuyerOrThrow(farmId, id, opts) {
        const buyer = await this.prisma.milkBuyer.findFirst({
            where: { id, farmId },
        });
        if (!buyer) {
            throw new common_1.NotFoundException('Buyer not found');
        }
        if (opts?.requireActive && buyer.deletedAt) {
            throw new common_1.BadRequestException('This buyer is deactivated and cannot receive new sales');
        }
        return buyer;
    }
};
exports.BuyerService = BuyerService;
exports.BuyerService = BuyerService = BuyerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sell_milk_use_case_1.SellMilkUseCase,
        void_sale_use_case_1.VoidSaleUseCase,
        dispatch_number_allocator_1.DispatchNumberAllocator,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], BuyerService);
//# sourceMappingURL=buyer.service.js.map