import request from 'supertest';
import { SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-374 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.7, §11) — `GET
 * /sales/summary?from&to&granularity`. Proves the ticket's own AC against
 * the real DB + HTTP surface:
 *
 * - zero-state: all KPIs 0, trend fully zero-filled (no gaps), empty
 *   byProduct/topBuyers;
 * - a MILK sale with no `Receivable` counts as paid in full; an ANIMAL sale
 *   with an unpaid `Receivable` raises `outstanding`;
 * - `byProduct` groups by `SaleLine.type` with a real `sharePct`;
 * - `topBuyers` aggregates by `customerId` with a real buyer name;
 * - Worker (no `sales.*`) gets 403.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — same precedent every
 * other business-ia read-model spec in this suite documents. Sales are
 * created directly via Prisma (not `POST /sales`, which posts no
 * `Receivable`/journal itself — RAKHAL-339's own documented scope) so the
 * fixture controls `saleDate`/`totalAmount`/receivable state exactly.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales summary (e2e, RAKHAL-374)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;
  let buyerId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    farmService = ctx.app.get(FarmService);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

    const farm = await farmService.create(ownerUserId, {
      name: unique('E2E-374-SalesFarm'),
    });
    farmId = farm.id;
    const login = await request(server())
      .post(api('/auth/login'))
      .send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId,
      })
      .expect(201);
    owner = { token: login.body.data.accessToken as string, farmId };

    const buyer = await request(server())
      .post(api('/buyers'))
      .set(...bearer(owner))
      .send({
        name: 'E2E-374 Dairy Co',
        phone: '01700000374',
        buyerType: 'DAIRY_COMPANY',
        basePricePerLitre: 45,
      })
      .expect(201);
    buyerId = buyer.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
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

  it('zero-state: all KPIs 0, trend fully zero-filled, empty groupings', async () => {
    const { from, to } = period();
    const res = await request(server())
      .get(api('/sales/summary'))
      .query({
        from: from.toISOString(),
        to: to.toISOString(),
        granularity: 'day',
      })
      .set(...bearer(owner))
      .expect(200);

    const body = res.body.data as {
      kpis: {
        totalSales: { current: number };
        totalInvoices: { current: number };
        paidAmount: { current: number };
        outstanding: { current: number };
      };
      trend: { bucket: string; amount: string }[];
      byProduct: unknown[];
      topBuyers: unknown[];
    };
    expect(body.kpis.totalSales.current).toBe(0);
    expect(body.kpis.totalInvoices.current).toBe(0);
    expect(body.kpis.paidAmount.current).toBe(0);
    expect(body.kpis.outstanding.current).toBe(0);
    expect(body.trend.length).toBeGreaterThan(0);
    for (const b of body.trend) {
      expect(b.amount).toBe('0');
    }
    expect(body.byProduct).toHaveLength(0);
    expect(body.topBuyers).toHaveLength(0);
  });

  it('reflects a paid-in-full MILK sale and an unpaid ANIMAL sale', async () => {
    const now = new Date();

    const milkSale = await prisma.sale.create({
      data: {
        farmId,
        customerId: buyerId,
        saleNumber: unique('E2E-374-INV-MILK'),
        saleDate: now,
        subtotal: 1000,
        totalAmount: 1000,
        status: SaleStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    await prisma.saleLine.create({
      data: {
        saleId: milkSale.id,
        type: SaleLineType.MILK,
        description: 'Milk sale',
        quantity: 100,
        unitPrice: 10,
        totalAmount: 1000,
      },
    });

    const animalSale = await prisma.sale.create({
      data: {
        farmId,
        customerId: buyerId,
        saleNumber: unique('E2E-374-INV-ANIMAL'),
        saleDate: now,
        subtotal: 500,
        totalAmount: 500,
        status: SaleStatus.CONFIRMED,
        createdById: ownerUserId,
      },
    });
    await prisma.saleLine.create({
      data: {
        saleId: animalSale.id,
        type: SaleLineType.ANIMAL,
        description: 'Animal sale',
        quantity: 1,
        unitPrice: 500,
        totalAmount: 500,
      },
    });
    await prisma.receivable.create({
      data: {
        farmId,
        saleId: animalSale.id,
        customerId: buyerId,
        totalAmount: 500,
        dueDate: null,
      },
    });

    const { from, to } = period();
    const res = await request(server())
      .get(api('/sales/summary'))
      .query({
        from: from.toISOString(),
        to: to.toISOString(),
        granularity: 'day',
      })
      .set(...bearer(owner))
      .expect(200);

    const body = res.body.data as {
      kpis: {
        totalSales: { current: number };
        totalInvoices: { current: number };
        paidAmount: { current: number };
        outstanding: { current: number };
      };
      trend: { bucket: string; amount: string }[];
      byProduct: { lineType: string; amount: string; sharePct: number }[];
      topBuyers: {
        customerId: string;
        name: string;
        amount: string;
        invoiceCount: number;
      }[];
    };

    expect(body.kpis.totalSales.current).toBe(1500);
    expect(body.kpis.totalInvoices.current).toBe(2);
    expect(body.kpis.paidAmount.current).toBe(1000);
    expect(body.kpis.outstanding.current).toBe(500);

    const trendTotal = body.trend.reduce((s, b) => s + Number(b.amount), 0);
    expect(trendTotal).toBe(1500);

    const milk = body.byProduct.find((p) => p.lineType === 'MILK');
    const animal = body.byProduct.find((p) => p.lineType === 'ANIMAL');
    expect(milk?.amount).toBe('1000');
    expect(animal?.amount).toBe('500');
    expect(milk?.sharePct).toBeCloseTo(66.7, 1);
    expect(animal?.sharePct).toBeCloseTo(33.3, 1);

    expect(body.topBuyers).toHaveLength(1);
    expect(body.topBuyers[0].customerId).toBe(buyerId);
    expect(body.topBuyers[0].name).toBe('E2E-374 Dairy Co');
    expect(body.topBuyers[0].amount).toBe('1500');
    expect(body.topBuyers[0].invoiceCount).toBe(2);
  });

  it('worker without sales.* is rejected', async () => {
    const worker = await loginAs(
      ctx,
      'worker@demo.rakhal.test',
      'WorkerPass123',
    );
    const { from, to } = period();
    await request(server())
      .get(api('/sales/summary'))
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set(...bearer(worker))
      .expect(403);
  });
});
