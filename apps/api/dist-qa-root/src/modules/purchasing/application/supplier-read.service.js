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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierReadService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
let SupplierReadService = class SupplierReadService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listSuppliers(farmId) {
        const [suppliers, purchaseAgg, payableOutstanding] = await Promise.all([
            this.prisma.supplier.findMany({
                where: { farmId },
                select: { id: true, name: true, phone: true, deletedAt: true },
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
            }),
            this.purchaseAggBySupplier(farmId),
            this.payableOutstandingBySupplier(farmId),
        ]);
        const purchaseById = new Map(purchaseAgg.map((r) => [r.supplierId, r]));
        const payableById = new Map(payableOutstanding.map((r) => [r.supplier_id, r.outstanding]));
        return suppliers.map((s) => {
            const purchase = purchaseById.get(s.id);
            return {
                id: s.id,
                name: s.name,
                phone: s.phone,
                totalPurchases: (0, money_1.toStorage)(purchase?.totalAmount ?? 0).toString(),
                payable: (0, money_1.toStorage)(payableById.get(s.id) ?? 0).toString(),
                lastPurchaseAt: purchase?.lastPurchaseAt?.toISOString() ?? null,
                status: !s.deletedAt ? 'ACTIVE' : 'INACTIVE',
            };
        });
    }
    async getSummary(farmId) {
        const [totalCount, activeCount, purchaseAgg, payableOutstanding] = await Promise.all([
            this.prisma.supplier.count({ where: { farmId } }),
            this.prisma.supplier.count({ where: { farmId, deletedAt: null } }),
            this.purchaseAggBySupplier(farmId),
            this.payableOutstandingBySupplier(farmId),
        ]);
        const totalPurchases = purchaseAgg.reduce((sum, r) => sum.plus((0, money_1.toStorage)(r.totalAmount ?? 0)), (0, money_1.toStorage)(0));
        const totalPayable = payableOutstanding.reduce((sum, r) => sum.plus((0, money_1.toStorage)(r.outstanding ?? 0)), (0, money_1.toStorage)(0));
        return {
            totalCount,
            activeCount,
            totalPurchases: totalPurchases.toString(),
            totalPayable: totalPayable.toString(),
        };
    }
    async purchaseAggBySupplier(farmId) {
        const rows = await this.prisma.purchase.groupBy({
            by: ['supplierId'],
            where: {
                farmId,
                supplierId: { not: null },
                status: { not: client_1.PurchaseStatus.VOIDED },
            },
            _sum: { totalAmount: true },
            _max: { purchaseDate: true },
        });
        return rows.map((r) => ({
            supplierId: r.supplierId,
            totalAmount: r._sum.totalAmount?.toString() ?? null,
            lastPurchaseAt: r._max.purchaseDate,
        }));
    }
    async payableOutstandingBySupplier(farmId) {
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH allocation_sums AS (
        SELECT "payableId" AS doc_id, SUM(amount) AS allocated
        FROM "PaymentAllocation"
        WHERE "payableId" IS NOT NULL
        GROUP BY "payableId"
      )
      SELECT
        d."supplierId" AS supplier_id,
        SUM(d."totalAmount" - COALESCE(a.allocated, 0))::text AS outstanding
      FROM "Payable" d
      LEFT JOIN allocation_sums a ON a.doc_id = d.id
      WHERE d."farmId" = ${farmId} AND d."supplierId" IS NOT NULL
        AND d."closedAt" IS NULL
      GROUP BY d."supplierId"
    `);
    }
};
exports.SupplierReadService = SupplierReadService;
exports.SupplierReadService = SupplierReadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SupplierReadService);
//# sourceMappingURL=supplier-read.service.js.map