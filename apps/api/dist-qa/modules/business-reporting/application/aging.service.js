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
exports.AgingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
const aging_1 = require("../domain/aging");
let AgingService = class AgingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getReceivablesAging(farmId, asOf) {
        const rows = await this.queryAging(farmId, asOf, 'Receivable', 'receivableId');
        return this.toReport(asOf, rows);
    }
    async getPayablesAging(farmId, asOf) {
        const rows = await this.queryAging(farmId, asOf, 'Payable', 'payableId');
        return this.toReport(asOf, rows);
    }
    async queryAging(farmId, asOf, table, allocationFk) {
        const bucketCase = (0, aging_1.buildAgingBucketCaseSql)('days_past_due');
        return this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH allocation_sums AS (
        SELECT "${client_1.Prisma.raw(allocationFk)}" AS doc_id, SUM(amount) AS allocated
        FROM "PaymentAllocation"
        WHERE "${client_1.Prisma.raw(allocationFk)}" IS NOT NULL
        GROUP BY "${client_1.Prisma.raw(allocationFk)}"
      ),
      open_docs AS (
        SELECT
          d."totalAmount" - COALESCE(a.allocated, 0) AS outstanding,
          GREATEST(0, (${asOf}::date - COALESCE(d."dueDate", ${asOf})::date))::int AS days_past_due
        FROM "${client_1.Prisma.raw(table)}" d
        LEFT JOIN allocation_sums a ON a.doc_id = d.id
        WHERE d."farmId" = ${farmId}
          ${table === 'Payable' ? client_1.Prisma.sql `AND d."closedAt" IS NULL` : client_1.Prisma.empty}
      )
      SELECT
        ${client_1.Prisma.raw(bucketCase)} AS bucket,
        SUM(outstanding)::text AS amount,
        COUNT(*) AS "invoiceCount"
      FROM open_docs
      WHERE outstanding > 0
      GROUP BY bucket
    `);
    }
    toReport(asOf, rows) {
        const byKey = new Map(rows.map((r) => [r.bucket, r]));
        let totalOutstanding = (0, money_1.toStorage)(0);
        let totalCount = 0;
        const buckets = aging_1.RECEIVABLE_AGING_BUCKETS.map((def) => {
            const row = byKey.get(def.key);
            const amount = (0, money_1.toStorage)(row?.amount ?? 0);
            const invoiceCount = row ? Number(row.invoiceCount) : 0;
            totalOutstanding = totalOutstanding.plus(amount);
            totalCount += invoiceCount;
            return { ...def, amount: amount.toString(), invoiceCount };
        });
        return {
            asOf: asOf.toISOString(),
            buckets,
            totalOutstanding: totalOutstanding.toString(),
            totalCount,
        };
    }
};
exports.AgingService = AgingService;
exports.AgingService = AgingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AgingService);
//# sourceMappingURL=aging.service.js.map