import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { SellMilkUseCase } from '../src/modules/sales/application/use-cases/sell-milk/sell-milk.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-364 (MILESTONE 22, `BUSINESS_IA_PRD.md` §7) — promote
 * `Sale.customerId`/`Receivable.customerId` from a plain scalar to a real
 * `MilkBuyer` FK. Proves the ticket's own AC against the real DB + HTTP
 * surface:
 *
 * - `POST /sales` with a real `MilkBuyer.id` succeeds and persists the FK
 *   (both the id and the resolved buyer name are readable back);
 * - a `customerId` belonging to another farm is rejected — the FK
 *   constraint alone cannot catch this (Postgres has no farm-scoped FK),
 *   so `SaleService.assertCustomerBelongsToFarm` is what closes the hole
 *   promoting the column to a FK would otherwise open;
 * - `Receivable.customerId === Sale.customerId` always, proven through
 *   `SellMilkUseCase` (the real caller of `ReceivableService.
 *   createReceivable`) — closes RD-062 (`customerId` was never persisted
 *   on any `Receivable` row before this ticket);
 * - `dueDate` defaults to `saleDate + MilkBuyer.paymentTermsDays` when the
 *   use case doesn't pass one explicitly;
 * - `GET /finance/receivables?customerId=` now actually matches (the
 *   filter existed since RAKHAL-340 but could never return a row).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales/Finance V2 — Customer FK promotion (e2e, RAKHAL-364)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let sellMilk: SellMilkUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    farmService = ctx.app.get(FarmService);
    sellMilk = ctx.app.get(SellMilkUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createBuyer(farmId: string) {
    return prisma.milkBuyer.create({
      data: {
        farmId,
        name: unique('E2E-364-Buyer'),
        buyerType: 'DIRECT_CONSUMER',
        createdBy: ownerUserId,
      },
    });
  }

  it('POST /sales with a real MilkBuyer.id persists the FK', async () => {
    const buyer = await createBuyer(owner.farmId);

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        customerId: buyer.id,
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: 'MANURE',
            description: 'E2E-364 manure sale',
            quantity: 1,
            unitPrice: 500,
          },
        ],
      });

    expect(res.status).toBe(201);
    const saleId = (res.body.data as { id: string }).id;

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { customer: true },
    });
    expect(sale.customerId).toBe(buyer.id);
    expect(sale.customer?.name).toBe(buyer.name);
  });

  it('POST /sales with no customerId still succeeds — a walk-up cash sale has no buyer', async () => {
    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: 'MANURE',
            description: 'E2E-364 walk-up sale',
            quantity: 1,
            unitPrice: 200,
          },
        ],
      });

    expect(res.status).toBe(201);
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: (res.body.data as { id: string }).id },
    });
    expect(sale.customerId).toBeNull();
  });

  it(
    'rejects a customerId belonging to another farm — a Prisma FK alone ' +
      'cannot enforce farm equality, so this must be an application-layer assert',
    async () => {
      const buyer = await createBuyer(owner.farmId);

      const farm2 = await farmService.create(ownerUserId, {
        name: unique('E2E-364-CrossFarm'),
      });
      const farm2Login = await request(server())
        .post(api('/auth/login'))
        .send({
          email: 'owner@demo.rakhal.test',
          password: 'DemoPass123',
          farmId: farm2.id,
        })
        .expect(201);
      const farm2Token = farm2Login.body.data.accessToken as string;

      const before = await prisma.sale.count({ where: { farmId: farm2.id } });

      const res = await request(server())
        .post(api('/sales'))
        .set('Authorization', `Bearer ${farm2Token}`)
        .send({
          customerId: buyer.id, // belongs to `owner.farmId`, not `farm2.id`
          saleDate: new Date().toISOString(),
          lines: [
            {
              type: 'MANURE',
              description: 'E2E-364 cross-farm rejection',
              quantity: 1,
              unitPrice: 100,
            },
          ],
        });

      expect(res.status).toBe(400);

      const after = await prisma.sale.count({ where: { farmId: farm2.id } });
      expect(after).toBe(before);
    },
  );

  it('SellMilkUseCase: Receivable.customerId === Sale.customerId, always', async () => {
    const buyer = await createBuyer(owner.farmId);

    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 10,
      pricePerLitre: 60,
      customerId: buyer.id,
      saleDate: new Date().toISOString(),
    });

    expect(result.sale.customerId).toBe(buyer.id);
    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivable.id },
    });
    expect(receivable.customerId).toBe(buyer.id);
    expect(receivable.customerId).toBe(result.sale.customerId);
  });

  it('derives Receivable.dueDate from saleDate + MilkBuyer.paymentTermsDays when not passed explicitly', async () => {
    const buyer = await prisma.milkBuyer.create({
      data: {
        farmId: owner.farmId,
        name: unique('E2E-364-Terms-Buyer'),
        buyerType: 'DIRECT_CONSUMER',
        paymentTermsDays: 10,
        createdBy: ownerUserId,
      },
    });
    const saleDate = new Date();

    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 5,
      pricePerLitre: 60,
      customerId: buyer.id,
      saleDate: saleDate.toISOString(),
      // dueDate intentionally omitted
    });

    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivable.id },
    });
    expect(receivable.dueDate).not.toBeNull();
    const expected = new Date(saleDate);
    expected.setUTCDate(expected.getUTCDate() + 10);
    expect(receivable.dueDate?.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });

  it('a buyer with paymentTermsDays=0 (COD) gets no due date, not "today"', async () => {
    const buyer = await createBuyer(owner.farmId); // default paymentTermsDays: 0

    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 5,
      pricePerLitre: 60,
      customerId: buyer.id,
      saleDate: new Date().toISOString(),
    });

    const receivable = await prisma.receivable.findUniqueOrThrow({
      where: { id: result.receivable.id },
    });
    expect(receivable.dueDate).toBeNull();
  });

  it('GET /finance/receivables?customerId= now matches — closes RD-062', async () => {
    const buyer = await createBuyer(owner.farmId);
    const result = await sellMilk.execute(owner.farmId, ownerUserId, {
      volumeL: 8,
      pricePerLitre: 60,
      customerId: buyer.id,
      saleDate: new Date().toISOString(),
    });

    const listed = await request(server())
      .get(api(`/finance/receivables?customerId=${buyer.id}`))
      .set(...bearer(owner))
      .expect(200);

    // The global ResponseEnvelopeInterceptor lifts `CursorPage.items`
    // straight into `data`: `{ success, data: items, meta }`, not
    // `{ data: { items, meta } }` — see `cursor-pagination.util.ts`'s own
    // doc comment.
    const items = listed.body.data as Array<{ id: string }>;
    expect(items.some((r) => r.id === result.receivable.id)).toBe(true);
  });
});
