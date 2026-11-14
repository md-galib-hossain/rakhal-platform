import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-372 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.10, §5.11) — Buyer read
 * model. Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - `GET /buyers` rows gain `outstanding`, `totalPurchased`,
 *   `lastPurchaseAt`, `status`;
 * - `GET /buyers/summary` → Total/Active Buyers, Total Sales, Total
 *   Outstanding;
 * - `GET /buyers/:id/overview` → `outstandingAmount`,
 *   `totalPurchasedThisYear`, `lastPayment`, `recentInvoices`, `info`;
 * - `GET /buyers/groups` → one row per `BuyerType` value, real counts/sums,
 *   zero-filled for a value with no buyers.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — same precedent
 * every other business-ia read-model spec in this suite documents.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Buyers — read model (e2e, RAKHAL-372)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
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

    const throwaway = await createThrowawayOwner(
      ctx,
      prisma,
      unique('E2E-372-BuyerFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    const buyer = await request(server())
      .post(api('/buyers'))
      .set(...bearer(owner))
      .send({
        name: 'E2E-372 Dairy Co',
        phone: '01700000372',
        buyerType: 'DAIRY_COMPANY',
        basePricePerLitre: 45,
      })
      .expect(201);
    buyerId = buyer.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await prisma.receivable
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.sale.deleteMany({ where: { farmId } }).catch(() => undefined);
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  it('GET /buyers rows carry zero outstanding/totalPurchased before any sale', async () => {
    const res = await request(server())
      .get(api('/buyers'))
      .set(...bearer(owner))
      .expect(200);
    const row = (
      res.body.data as {
        id: string;
        outstanding: string;
        totalPurchased: string;
        lastPurchaseAt: string | null;
        status: string;
      }[]
    ).find((r) => r.id === buyerId);
    expect(row).toBeDefined();
    expect(row?.outstanding).toBe('0');
    expect(row?.totalPurchased).toBe('0');
    expect(row?.lastPurchaseAt).toBeNull();
    expect(row?.status).toBe('ACTIVE');
  });

  it('reflects a real Sale+Receivable on the buyer row, summary, overview, and groups', async () => {
    const sale = await prisma.sale.create({
      data: {
        farmId,
        customerId: buyerId,
        saleNumber: unique('E2E-372-INV'),
        saleDate: new Date(),
        subtotal: 1200,
        totalAmount: 1200,
        createdById: ownerUserId,
      },
    });
    await prisma.receivable.create({
      data: {
        farmId,
        saleId: sale.id,
        customerId: buyerId,
        totalAmount: 1200,
        dueDate: null,
      },
    });

    const listRes = await request(server())
      .get(api('/buyers'))
      .set(...bearer(owner))
      .expect(200);
    const row = (
      listRes.body.data as {
        id: string;
        outstanding: string;
        totalPurchased: string;
        lastPurchaseAt: string | null;
      }[]
    ).find((r) => r.id === buyerId);
    expect(row?.outstanding).toBe('1200');
    expect(row?.totalPurchased).toBe('1200');
    expect(row?.lastPurchaseAt).not.toBeNull();

    const summaryRes = await request(server())
      .get(api('/buyers/summary'))
      .set(...bearer(owner))
      .expect(200);
    const summary = summaryRes.body.data as {
      totalBuyers: number;
      activeBuyers: number;
      totalSales: string;
      totalOutstanding: string;
    };
    expect(summary.totalBuyers).toBe(1);
    expect(summary.activeBuyers).toBe(1);
    expect(summary.totalSales).toBe('1200');
    expect(summary.totalOutstanding).toBe('1200');

    const overviewRes = await request(server())
      .get(api(`/buyers/${buyerId}/overview`))
      .set(...bearer(owner))
      .expect(200);
    const overview = overviewRes.body.data as {
      outstandingAmount: string;
      totalPurchasedThisYear: string;
      lastPayment: unknown;
      recentInvoices: { id: string; saleNumber: string }[];
      info: {
        phone: string | null;
        address: string | null;
        paymentTermsDays: number;
        basePricePerLitre: number;
        buyerType: string;
      };
    };
    expect(overview.outstandingAmount).toBe('1200');
    expect(overview.totalPurchasedThisYear).toBe('1200');
    expect(overview.lastPayment).toBeNull();
    expect(overview.recentInvoices).toHaveLength(1);
    expect(overview.recentInvoices[0].id).toBe(sale.id);
    expect(overview.info.phone).toBe('01700000372');
    expect(overview.info.address).toBeNull();
    expect(overview.info.buyerType).toBe('DAIRY_COMPANY');
    expect(overview.info.basePricePerLitre).toBe(45);

    const groupsRes = await request(server())
      .get(api('/buyers/groups'))
      .set(...bearer(owner))
      .expect(200);
    const groups = groupsRes.body.data as {
      buyerType: string;
      buyerCount: number;
      totalSales: string;
    }[];
    expect(groups).toHaveLength(4);
    const dairyGroup = groups.find((g) => g.buyerType === 'DAIRY_COMPANY');
    expect(dairyGroup?.buyerCount).toBe(1);
    expect(dairyGroup?.totalSales).toBe('1200');
    const emptyGroup = groups.find((g) => g.buyerType === 'LOCAL_TRADER');
    expect(emptyGroup?.buyerCount).toBe(0);
    expect(emptyGroup?.totalSales).toBe('0');
  });
});
