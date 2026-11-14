import { Injectable } from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toStorage } from 'src/common/money';

export interface SupplierListRow {
  id: string;
  name: string;
  phone: string | null;
  totalPurchases: string;
  payable: string;
  lastPurchaseAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface SupplierSummary {
  totalCount: number;
  activeCount: number;
  totalPurchases: string;
  totalPayable: string;
}

interface PurchaseAggRow {
  supplierId: string | null;
  totalAmount: string | null;
  lastPurchaseAt: Date | null;
}

interface PayableOutstandingRow {
  supplier_id: string;
  outstanding: string | null;
}

/**
 * Supplier read model (RAKHAL-373, MILESTONE 22, `BUSINESS_IA_PRD.md` §5.12).
 * Deliberately a **read-only sibling** of `SettingsModule`'s existing
 * `/settings/suppliers` CRUD — the Suppliers *page* writes there and reads
 * here, the same coexistence pattern `/buyers` (writes) and
 * `/finance/receivables` (aging reads) already established. **Zero
 * `app.module.ts` churn, zero `permission-catalogue.ts` churn**: this lives
 * inside the already-registered `PurchasingModule`, gated on the
 * already-catalogued `purchasing.read` (via the `purchasing.*` wildcard),
 * never touching `settings.*` at all.
 *
 * Not paginated, matching `WorkspaceSettingsService.listSuppliers`'s own
 * precedent — a farm's supplier directory is a small, bounded list, not a
 * page-scale collection.
 */
@Injectable()
export class SupplierReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(farmId: string): Promise<SupplierListRow[]> {
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
    const payableById = new Map(
      payableOutstanding.map((r) => [r.supplier_id, r.outstanding]),
    );

    return suppliers.map((s) => {
      const purchase = purchaseById.get(s.id);
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        totalPurchases: toStorage(purchase?.totalAmount ?? 0).toString(),
        payable: toStorage(payableById.get(s.id) ?? 0).toString(),
        lastPurchaseAt: purchase?.lastPurchaseAt?.toISOString() ?? null,
        status: !s.deletedAt ? 'ACTIVE' : 'INACTIVE',
      };
    });
  }

  async getSummary(farmId: string): Promise<SupplierSummary> {
    const [totalCount, activeCount, purchaseAgg, payableOutstanding] =
      await Promise.all([
        this.prisma.supplier.count({ where: { farmId } }),
        this.prisma.supplier.count({ where: { farmId, deletedAt: null } }),
        this.purchaseAggBySupplier(farmId),
        this.payableOutstandingBySupplier(farmId),
      ]);

    const totalPurchases = purchaseAgg.reduce(
      (sum, r) => sum.plus(toStorage(r.totalAmount ?? 0)),
      toStorage(0),
    );
    const totalPayable = payableOutstanding.reduce(
      (sum, r) => sum.plus(toStorage(r.outstanding ?? 0)),
      toStorage(0),
    );

    return {
      totalCount,
      activeCount,
      totalPurchases: totalPurchases.toString(),
      totalPayable: totalPayable.toString(),
    };
  }

  /** `Purchase.totalAmount` summed + `MAX(purchaseDate)`, grouped by
   * `supplierId` — a plain Prisma `groupBy` suffices here (no computed key,
   * no join needed), unlike the payable side below. */
  private async purchaseAggBySupplier(
    farmId: string,
  ): Promise<PurchaseAggRow[]> {
    const rows = await this.prisma.purchase.groupBy({
      by: ['supplierId'],
      where: {
        farmId,
        supplierId: { not: null },
        status: { not: PurchaseStatus.VOIDED },
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

  /** Outstanding `Payable` balance per supplier — same
   * `totalAmount - SUM(PaymentAllocation.amount)` shape `AgingService`
   * uses, grouped by `supplierId` instead of an aging bucket. Raw SQL for
   * the same reason: the value needs a `LEFT JOIN` sum before `GROUP BY`
   * can run, which `Prisma.groupBy` cannot express. `farmId` is a real bound
   * parameter, never string-concatenated — no injection risk. */
  private async payableOutstandingBySupplier(
    farmId: string,
  ): Promise<PayableOutstandingRow[]> {
    return this.prisma.$queryRaw<PayableOutstandingRow[]>(Prisma.sql`
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
}
