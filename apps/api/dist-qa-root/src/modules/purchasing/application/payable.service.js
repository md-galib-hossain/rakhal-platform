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
var PayableService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayableService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const payable_status_1 = require("../domain/payable-status");
let PayableService = PayableService_1 = class PayableService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(PayableService_1.name);
    }
    async createPayable(farmId, params, tx) {
        const client = tx ?? this.prisma;
        const hasPurchase = !!params.purchaseId;
        const hasExpense = !!params.expenseId;
        if (hasPurchase === hasExpense) {
            throw new common_1.BadRequestException('A payable must be raised for exactly one of purchaseId or expenseId');
        }
        const amount = (0, money_1.toStorage)(params.totalAmount);
        if (!(0, money_1.gt)(amount, 0)) {
            throw new common_1.BadRequestException('Payable totalAmount must be greater than zero');
        }
        const payable = await client.payable.create({
            data: {
                farmId,
                purchaseId: params.purchaseId ?? null,
                expenseId: params.expenseId ?? null,
                supplierId: params.supplierId ?? null,
                totalAmount: amount,
                dueDate: params.dueDate ?? null,
            },
        });
        this.log.info('Payable created', {
            farmId,
            payableId: payable.id,
            purchaseId: params.purchaseId ?? null,
            expenseId: params.expenseId ?? null,
            totalAmount: amount.toString(),
        });
        return payable;
    }
    async getOutstanding(farmId, payableId, tx) {
        const { outstanding } = await this.getFigures(farmId, payableId, tx);
        return outstanding;
    }
    async getStatus(farmId, payableId, tx) {
        const { payable, allocated, outstanding } = await this.getFigures(farmId, payableId, tx);
        return this.deriveStatus(payable, allocated, outstanding);
    }
    async assertWithinOutstanding(farmId, payableId, amount, tx) {
        const outstanding = await this.getOutstanding(farmId, payableId, tx);
        if ((0, money_1.gt)(amount, outstanding)) {
            throw new common_1.BadRequestException('Allocation exceeds the payable outstanding amount — a payable cannot be over-allocated');
        }
    }
    async closeIfSettled(farmId, payableId, tx) {
        const client = tx ?? this.prisma;
        const { payable, outstanding } = await this.getFigures(farmId, payableId, tx);
        if (payable.closedAt || !(0, money_1.isZero)(outstanding)) {
            return;
        }
        await client.payable.update({
            where: { id: payableId },
            data: { closedAt: new Date() },
        });
    }
    async findOne(farmId, payableId) {
        const { payable, allocated, outstanding } = await this.getFigures(farmId, payableId);
        const status = this.deriveStatus(payable, allocated, outstanding);
        return { ...payable, outstanding: outstanding.toString(), status };
    }
    async listPayables(farmId, query) {
        const where = {
            farmId,
            AND: [
                {
                    OR: [
                        { purchaseId: null },
                        { purchase: { status: { not: 'VOIDED' } } },
                    ],
                },
                { OR: [{ expenseId: null }, { expense: { voidedAt: null } }] },
            ],
        };
        if (query.supplierId) {
            where.supplierId = query.supplierId;
        }
        if (query.dueBefore || query.dueAfter) {
            where.dueDate = {
                ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
                ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
            };
        }
        const rows = await this.prisma.payable.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        if (page.items.length === 0) {
            return { items: [], meta: page.meta };
        }
        const sums = await this.prisma.paymentAllocation.groupBy({
            by: ['payableId'],
            where: { payableId: { in: page.items.map((p) => p.id) } },
            _sum: { amount: true },
        });
        const allocatedById = new Map(sums.map((s) => [s.payableId, s._sum.amount ?? 0]));
        const items = page.items.map((payable) => {
            const allocated = allocatedById.get(payable.id) ?? 0;
            const outstanding = this.computeOutstanding(payable, allocated);
            const status = this.deriveStatus(payable, allocated, outstanding);
            return { ...payable, outstanding: outstanding.toString(), status };
        });
        return { items, meta: page.meta };
    }
    async getFigures(farmId, payableId, tx) {
        const client = tx ?? this.prisma;
        const payable = await client.payable.findFirst({
            where: { id: payableId, farmId },
        });
        if (!payable) {
            throw new common_1.NotFoundException('Payable not found');
        }
        const agg = await client.paymentAllocation.aggregate({
            where: { payableId: payable.id },
            _sum: { amount: true },
        });
        const allocated = agg._sum.amount ?? 0;
        const outstanding = this.computeOutstanding(payable, allocated);
        return { payable, allocated: (0, money_1.toStorage)(allocated), outstanding };
    }
    computeOutstanding(payable, allocated) {
        const raw = (0, money_1.subtract)(payable.totalAmount, allocated);
        return raw.isNegative() ? (0, money_1.toStorage)(0) : (0, money_1.toStorage)(raw);
    }
    deriveStatus(payable, allocated, outstanding) {
        let status;
        if ((0, money_1.isZero)(allocated)) {
            status = payable_status_1.PayableStatus.UNPAID;
        }
        else if ((0, money_1.gte)(allocated, payable.totalAmount)) {
            status = payable_status_1.PayableStatus.PAID;
        }
        else {
            status = payable_status_1.PayableStatus.PARTIALLY_PAID;
        }
        if (status !== payable_status_1.PayableStatus.PAID &&
            payable.dueDate &&
            payable.dueDate.getTime() < Date.now() &&
            !(0, money_1.isZero)(outstanding)) {
            status = payable_status_1.PayableStatus.OVERDUE;
        }
        return status;
    }
};
exports.PayableService = PayableService;
exports.PayableService = PayableService = PayableService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], PayableService);
//# sourceMappingURL=payable.service.js.map