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
var ReceivableService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceivableService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const receivable_status_1 = require("../domain/receivable-status");
let ReceivableService = ReceivableService_1 = class ReceivableService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ReceivableService_1.name);
    }
    async createReceivable(farmId, saleId, totalAmount, dueDate, tx, customerId) {
        const client = tx ?? this.prisma;
        const amount = (0, money_1.toStorage)(totalAmount);
        if (!(0, money_1.gt)(amount, 0)) {
            throw new common_1.BadRequestException('Receivable totalAmount must be greater than zero');
        }
        const receivable = await client.receivable.create({
            data: {
                farmId,
                saleId,
                customerId: customerId ?? null,
                totalAmount: amount,
                dueDate: dueDate ?? null,
            },
        });
        this.log.info('Receivable created', {
            farmId,
            receivableId: receivable.id,
            saleId,
            customerId: customerId ?? null,
            totalAmount: amount.toString(),
        });
        return receivable;
    }
    async getOutstanding(farmId, receivableId, tx) {
        const { outstanding } = await this.getFigures(farmId, receivableId, tx);
        return outstanding;
    }
    async getStatus(farmId, receivableId, tx) {
        const { receivable, allocated, outstanding } = await this.getFigures(farmId, receivableId, tx);
        return this.deriveStatus(receivable, allocated, outstanding);
    }
    async assertWithinOutstanding(farmId, receivableId, amount, tx) {
        const outstanding = await this.getOutstanding(farmId, receivableId, tx);
        if ((0, money_1.gt)(amount, outstanding)) {
            throw new common_1.BadRequestException('Allocation exceeds the receivable outstanding amount — a receivable cannot be over-allocated');
        }
    }
    async closeIfSettled(farmId, receivableId, tx) {
        const client = tx ?? this.prisma;
        const { receivable, outstanding } = await this.getFigures(farmId, receivableId, tx);
        if (receivable.closedAt || !(0, money_1.isZero)(outstanding)) {
            return;
        }
        await client.receivable.update({
            where: { id: receivableId },
            data: { closedAt: new Date() },
        });
    }
    async findOne(farmId, receivableId) {
        const { receivable, allocated, outstanding } = await this.getFigures(farmId, receivableId);
        const status = this.deriveStatus(receivable, allocated, outstanding);
        return { ...receivable, outstanding: outstanding.toString(), status };
    }
    async listReceivables(farmId, query) {
        const where = { farmId };
        if (query.customerId) {
            where.customerId = query.customerId;
        }
        if (query.dueBefore || query.dueAfter) {
            where.dueDate = {
                ...(query.dueBefore ? { lte: new Date(query.dueBefore) } : {}),
                ...(query.dueAfter ? { gte: new Date(query.dueAfter) } : {}),
            };
        }
        const rows = await this.prisma.receivable.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        if (page.items.length === 0) {
            return { items: [], meta: page.meta };
        }
        const sums = await this.prisma.paymentAllocation.groupBy({
            by: ['receivableId'],
            where: { receivableId: { in: page.items.map((r) => r.id) } },
            _sum: { amount: true },
        });
        const allocatedById = new Map(sums.map((s) => [s.receivableId, s._sum.amount ?? 0]));
        const items = page.items.map((receivable) => {
            const allocated = allocatedById.get(receivable.id) ?? 0;
            const outstanding = this.computeOutstanding(receivable, allocated);
            const status = this.deriveStatus(receivable, allocated, outstanding);
            return { ...receivable, outstanding: outstanding.toString(), status };
        });
        return { items, meta: page.meta };
    }
    async getFigures(farmId, receivableId, tx) {
        const client = tx ?? this.prisma;
        const receivable = await client.receivable.findFirst({
            where: { id: receivableId, farmId },
        });
        if (!receivable) {
            throw new common_1.NotFoundException('Receivable not found');
        }
        const agg = await client.paymentAllocation.aggregate({
            where: { receivableId: receivable.id },
            _sum: { amount: true },
        });
        const allocated = agg._sum.amount ?? 0;
        const outstanding = this.computeOutstanding(receivable, allocated);
        return { receivable, allocated: (0, money_1.toStorage)(allocated), outstanding };
    }
    computeOutstanding(receivable, allocated) {
        const raw = (0, money_1.subtract)(receivable.totalAmount, allocated);
        return raw.isNegative() ? (0, money_1.toStorage)(0) : (0, money_1.toStorage)(raw);
    }
    deriveStatus(receivable, allocated, outstanding) {
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
};
exports.ReceivableService = ReceivableService;
exports.ReceivableService = ReceivableService = ReceivableService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ReceivableService);
//# sourceMappingURL=receivable.service.js.map