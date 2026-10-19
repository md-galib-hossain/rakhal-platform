import request from 'supertest';
import { PurchaseStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-375 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.13) — `GET
 * /purchasing/summary?from&to` + `GET /purchasing/purchases`/`/expenses`
 * cursor pagination + filters. Proves the ticket's own AC against the real
 * DB + HTTP surface:
 *
 * - zero-state summary: all KPIs 0;
 * - a `Purchase` with no `Payable` (paid in full at creation) plus one with
 *   an unpaid `Payable` correctly reflected in totalPurchases/paidAmount/
 *   payable/purchaseOrders;
 * - `GET /purchasing/purchases?paymentStatus=` compiles to a real SQL
 *   `where`, proven by checking each purchase lands in the correct filter;
 * - `GET /purchasing/expenses?category=` filters server-side;
 * - Worker (no `purchasing.*`) gets 403 on the summary route.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — same precedent
 * every other business-ia read-model spec in this suite documents. Purchases
 * are created directly via Prisma (not `POST /purchasing/purchases`, which
 * requires real inventory-item lines out of scope for a read-model test —
 * same precedent RAKHAL-373's supplier-read spec already uses).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing summary + list filters (e2e, RAKHAL-375)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;
  let supplierId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);

    const throwaway = await createThrowawayOwner(
      ctx,
      prisma,
      unique('E2E-375-PurchasingFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    const supplier = await prisma.supplier.create({
      data: { farmId, name: 'E2E-375 Feed Supplier', paymentTermsDays: 0 },
    });
    supplierId = supplier.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.payable
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.purchase
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.supplier
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  const period = () => {
    const to = new Date();
    to.setUTCHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 6);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to };
  };

  it('zero-state summary: all KPIs 0', async () => {
    const { from, to } = period();
    const res = await request(server())
      .get(api('/purchasing/summary'))
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set(...bearer(owner))
      .expect(200);

    const body = res.body.data as {
      kpis: {
        totalPurchases: { current: number };
        paidAmount: { current: number };
        payable: { current: number };
        purchaseOrders: { current: number };
      };
    };
    expect(body.kpis.totalPurchases.current).toBe(0);
    expect(body.kpis.paidAmount.current).toBe(0);
    expect(body.kpis.payable.current).toBe(0);
    expect(body.kpis.purchaseOrders.current).toBe(0);
  });

  it('reflects a paid-in-full purchase and an unpaid purchase; filters purchases by paymentStatus', async () => {
    const now = new Date();

    const paidPurchase = await prisma.purchase.create({
      data: {
        farmId,
        supplierId,
        purchaseNumber: unique('E2E-375-PUR-PAID'),
        purchaseDate: now,
        totalAmount: 2000,
        status: PurchaseStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });

    const unpaidPurchase = await prisma.purchase.create({
      data: {
        farmId,
        supplierId,
        purchaseNumber: unique('E2E-375-PUR-UNPAID'),
        purchaseDate: now,
        totalAmount: 800,
        status: PurchaseStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    await prisma.payable.create({
      data: {
        farmId,
        purchaseId: unpaidPurchase.id,
        supplierId,
        totalAmount: 800,
        dueDate: null,
      },
    });

    const { from, to } = period();
    const summaryRes = await request(server())
      .get(api('/purchasing/summary'))
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set(...bearer(owner))
      .expect(200);
    const summary = summaryRes.body.data as {
      kpis: {
        totalPurchases: { current: number };
        paidAmount: { current: number };
        payable: { current: number };
        purchaseOrders: { current: number };
      };
    };
    expect(summary.kpis.totalPurchases.current).toBe(2800);
    expect(summary.kpis.paidAmount.current).toBe(2000);
    expect(summary.kpis.payable.current).toBe(800);
    expect(summary.kpis.purchaseOrders.current).toBe(2);

    const paidListRes = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ paymentStatus: 'PAID' })
      .set(...bearer(owner))
      .expect(200);
    const paidIds = (paidListRes.body.data as { id: string }[]).map(
      (p) => p.id,
    );
    expect(paidIds).toContain(paidPurchase.id);
    expect(paidIds).not.toContain(unpaidPurchase.id);

    const unpaidListRes = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ paymentStatus: 'UNPAID' })
      .set(...bearer(owner))
      .expect(200);
    const unpaidIds = (unpaidListRes.body.data as { id: string }[]).map(
      (p) => p.id,
    );
    expect(unpaidIds).toContain(unpaidPurchase.id);
    expect(unpaidIds).not.toContain(paidPurchase.id);

    const supplierFilterRes = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ supplierId })
      .set(...bearer(owner))
      .expect(200);
    expect(
      (supplierFilterRes.body.data as { id: string }[]).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('counts the part paid up front: ৳1,000 purchase with ৳400 paid at creation (payable ৳600) → paid +400, payable +600', async () => {
    const { from, to } = period();
    const read = async () => {
      const res = await request(server())
        .get(api('/purchasing/summary'))
        .query({ from: from.toISOString(), to: to.toISOString() })
        .set(...bearer(owner))
        .expect(200);
      return (
        res.body.data as {
          kpis: {
            totalPurchases: { current: number };
            paidAmount: { current: number };
            payable: { current: number };
          };
        }
      ).kpis;
    };
    const before = await read();

    const purchase = await prisma.purchase.create({
      data: {
        farmId,
        supplierId,
        purchaseNumber: unique('E2E-375-PUR-PART'),
        purchaseDate: new Date(),
        totalAmount: 1000,
        status: PurchaseStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    // The payable holds only the UNPAID remainder (1000 - 400 paid up front).
    await prisma.payable.create({
      data: { farmId, purchaseId: purchase.id, supplierId, totalAmount: 600 },
    });

    const after = await read();
    expect(after.totalPurchases.current - before.totalPurchases.current).toBe(
      1000,
    );
    expect(after.paidAmount.current - before.paidAmount.current).toBe(400);
    expect(after.payable.current - before.payable.current).toBe(600);

    // The list row derives the same split server-side.
    const list = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ supplierId })
      .set(...bearer(owner))
      .expect(200);
    const row = (
      list.body.data as {
        id: string;
        paymentStatus: string | null;
        outstanding: string;
        paidAmount: string;
      }[]
    ).find((p) => p.id === purchase.id);
    expect(row?.paymentStatus).toBe('UNPAID');
    expect(row?.outstanding).toBe('600.00');
    expect(row?.paidAmount).toBe('400.00');
  });

  it('a VOIDED purchase is excluded from the summary and has no payment status in the list', async () => {
    const { from, to } = period();
    const read = async () => {
      const res = await request(server())
        .get(api('/purchasing/summary'))
        .query({ from: from.toISOString(), to: to.toISOString() })
        .set(...bearer(owner))
        .expect(200);
      return (
        res.body.data as {
          kpis: {
            totalPurchases: { current: number };
            purchaseOrders: { current: number };
          };
        }
      ).kpis;
    };
    const before = await read();

    const voided = await prisma.purchase.create({
      data: {
        farmId,
        supplierId,
        purchaseNumber: unique('E2E-375-PUR-VOID'),
        purchaseDate: new Date(),
        totalAmount: 5000,
        status: PurchaseStatus.VOIDED,
        createdById: ownerUserId,
      },
    });
    await prisma.payable.create({
      data: {
        farmId,
        purchaseId: voided.id,
        supplierId,
        totalAmount: 5000,
        closedAt: new Date(),
      },
    });

    const after = await read();
    expect(after.totalPurchases.current).toBe(before.totalPurchases.current);
    expect(after.purchaseOrders.current).toBe(before.purchaseOrders.current);

    const list = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ supplierId })
      .set(...bearer(owner))
      .expect(200);
    const row = (
      list.body.data as {
        id: string;
        paymentStatus: string | null;
        outstanding: string;
      }[]
    ).find((p) => p.id === voided.id);
    expect(row?.paymentStatus).toBeNull();
    expect(row?.outstanding).toBe('0.00');

    // And it never matches a payment-status filter.
    const unpaid = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ paymentStatus: 'UNPAID' })
      .set(...bearer(owner))
      .expect(200);
    expect(
      (unpaid.body.data as { id: string }[]).map((p) => p.id),
    ).not.toContain(voided.id);
    const paid = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ paymentStatus: 'PAID' })
      .set(...bearer(owner))
      .expect(200);
    expect((paid.body.data as { id: string }[]).map((p) => p.id)).not.toContain(
      voided.id,
    );
  });

  it('filters expenses by category and paymentStatus', async () => {
    const unpaidExpense = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: 'E2E-375 electricity bill',
        amount: 500,
        expenseDate: new Date().toISOString(),
      })
      .expect(201);

    const salaryExpense = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'SALARY',
        description: 'E2E-375 salary',
        amount: 300,
        expenseDate: new Date().toISOString(),
      })
      .expect(201);

    const utilitiesRes = await request(server())
      .get(api('/purchasing/expenses'))
      .query({ category: 'UTILITIES' })
      .set(...bearer(owner))
      .expect(200);
    const utilitiesIds = (utilitiesRes.body.data as { id: string }[]).map(
      (e) => e.id,
    );
    expect(utilitiesIds).toContain(unpaidExpense.body.data.id as string);
    expect(utilitiesIds).not.toContain(salaryExpense.body.data.id as string);

    const unpaidRes = await request(server())
      .get(api('/purchasing/expenses'))
      .query({ paymentStatus: 'UNPAID' })
      .set(...bearer(owner))
      .expect(200);
    const unpaidIds = (unpaidRes.body.data as { id: string }[]).map(
      (e) => e.id,
    );
    expect(unpaidIds).toContain(unpaidExpense.body.data.id as string);
  });

  it('worker without purchasing.* is rejected on the summary route', async () => {
    const worker = await loginAs(
      ctx,
      'worker@demo.rakhal.test',
      'WorkerPass123',
    );
    const { from, to } = period();
    await request(server())
      .get(api('/purchasing/summary'))
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set(...bearer(worker))
      .expect(403);
  });
});
