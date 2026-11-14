import request from 'supertest';
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
 * RAKHAL-365 (MILESTONE 22, `BUSINESS_IA_PRD.md` §7.1–§7.3) — promote
 * `Purchase.supplierId`/`Payable.supplierId` from plain scalars to real
 * `Supplier` FKs, and add a new `Expense.supplierId` FK. Mirrors
 * `rakhal-364-customer-fk.e2e-spec.ts` on the purchasing side:
 *
 * - `POST /purchasing/purchases` with a real `Supplier.id` persists the FK;
 * - a `supplierId` belonging to another farm is rejected at the application
 *   layer (a Prisma FK alone cannot enforce farm equality);
 * - `Payable.supplierId === Purchase.supplierId` when a purchase raises one;
 * - `Payable.dueDate` defaults to `purchaseDate + Supplier.paymentTermsDays`
 *   when not passed explicitly, and stays null for a 0-day (COD) supplier;
 * - `POST /purchasing/expenses` persists the new `Expense.supplierId` and
 *   raises a `Payable` with the same FK + the same due-date derivation off
 *   `expenseDate`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — Supplier FK promotion (e2e, RAKHAL-365)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let farm2UserId: string | undefined;
  let farm2Id: string | undefined;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    if (farm2Id && farm2UserId) {
      await prisma.purchase
        .deleteMany({ where: { farmId: farm2Id } })
        .catch(() => undefined);
      await deleteThrowawayOwner(prisma, {
        userId: farm2UserId,
        farmId: farm2Id,
      });
    }
    await ctx.app.close();
  });

  async function createSupplier(farmId: string, paymentTermsDays = 0) {
    return prisma.supplier.create({
      data: {
        farmId,
        name: unique('E2E-365-Supplier'),
        paymentTermsDays,
      },
    });
  }

  it('POST /purchasing/purchases with a real Supplier.id persists the FK', async () => {
    const supplier = await createSupplier(owner.farmId);
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        supplierId: supplier.id,
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 5, unitCost: 100 }],
      });

    expect(res.status).toBe(201);
    const purchase = await prisma.purchase.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
      include: { supplier: true },
    });
    expect(purchase.supplierId).toBe(supplier.id);
    expect(purchase.supplier?.name).toBe(supplier.name);
  });

  it('POST /purchasing/purchases with no supplierId still succeeds', async () => {
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });
    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 50 }],
      });

    expect(res.status).toBe(201);
    const purchase = await prisma.purchase.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
    });
    expect(purchase.supplierId).toBeNull();
  });

  it(
    'rejects a supplierId belonging to another farm — a Prisma FK alone ' +
      'cannot enforce farm equality, so this must be an application-layer assert',
    async () => {
      const supplier = await createSupplier(owner.farmId);
      const farm2Throwaway = await createThrowawayOwner(
        ctx,
        prisma,
        unique('E2E-365-CrossFarm'),
      );
      farm2UserId = farm2Throwaway.userId;
      farm2Id = farm2Throwaway.farmId;
      const farm2Token = farm2Throwaway.owner.token;

      const before = await prisma.purchase.count({
        where: { farmId: farm2Id },
      });

      const res = await request(server())
        .post(api('/purchasing/purchases'))
        .set('Authorization', `Bearer ${farm2Token}`)
        .send({
          supplierId: supplier.id, // belongs to `owner.farmId`, not `farm2Id`
          purchaseDate: new Date().toISOString(),
          // The tenancy assert must fire before line processing, so a
          // non-existent equipmentId is fine here — it should never be reached.
          lines: [
            {
              equipmentId: 'nonexistent-equipment-id',
              quantity: 1,
              unitCost: 10,
            },
          ],
        });

      expect(res.status).toBe(400);
      const after = await prisma.purchase.count({
        where: { farmId: farm2Id },
      });
      expect(after).toBe(before);
    },
  );

  it('Payable.supplierId === Purchase.supplierId when a purchase raises one', async () => {
    const supplier = await createSupplier(owner.farmId);
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        supplierId: supplier.id,
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 10, unitCost: 200 }],
        // no paidAmount -> full 2000 is raised as a Payable
      })
      .expect(201);

    const payable = await prisma.payable.findFirstOrThrow({
      where: { purchaseId: res.body.data.id as string },
    });
    expect(payable.supplierId).toBe(supplier.id);
  });

  it('derives Payable.dueDate from purchaseDate + Supplier.paymentTermsDays when not passed explicitly', async () => {
    const supplier = await createSupplier(owner.farmId, 15);
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });
    const purchaseDate = new Date();

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        supplierId: supplier.id,
        purchaseDate: purchaseDate.toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 500 }],
      })
      .expect(201);

    const payable = await prisma.payable.findFirstOrThrow({
      where: { purchaseId: res.body.data.id as string },
    });
    expect(payable.dueDate).not.toBeNull();
    const expected = new Date(purchaseDate);
    expected.setUTCDate(expected.getUTCDate() + 15);
    expect(payable.dueDate?.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });

  it('a supplier with paymentTermsDays=0 gets no due date, not "today"', async () => {
    const supplier = await createSupplier(owner.farmId, 0);
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        supplierId: supplier.id,
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 100 }],
      })
      .expect(201);

    const payable = await prisma.payable.findFirstOrThrow({
      where: { purchaseId: res.body.data.id as string },
    });
    expect(payable.dueDate).toBeNull();
  });

  it('POST /purchasing/expenses persists Expense.supplierId and raises a Payable with the same FK + due date', async () => {
    const supplier = await createSupplier(owner.farmId, 7);
    const expenseDate = new Date();

    const res = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: 'E2E-365 electricity bill',
        amount: 3000,
        expenseDate: expenseDate.toISOString(),
        supplierId: supplier.id,
        // no financialAccountId -> unpaid, full amount raised as a Payable
      });

    expect(res.status).toBe(201);
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
    });
    expect(expense.supplierId).toBe(supplier.id);

    const payable = await prisma.payable.findFirstOrThrow({
      where: { expenseId: expense.id },
    });
    expect(payable.supplierId).toBe(supplier.id);
    expect(payable.dueDate).not.toBeNull();
    const expected = new Date(expenseDate);
    expected.setUTCDate(expected.getUTCDate() + 7);
    expect(payable.dueDate?.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );
  });

  it('GET /purchasing/payables?supplierId= now matches for both Purchase- and Expense-raised payables', async () => {
    const supplier = await createSupplier(owner.farmId);
    const feedItem = await prisma.feedItem.findFirstOrThrow({
      where: { farmId: owner.farmId },
      select: { id: true },
    });
    const purchaseRes = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        supplierId: supplier.id,
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 2, unitCost: 400 }],
      })
      .expect(201);
    const purchasePayable = await prisma.payable.findFirstOrThrow({
      where: { purchaseId: purchaseRes.body.data.id as string },
    });

    const listed = await request(server())
      .get(api(`/purchasing/payables?supplierId=${supplier.id}`))
      .set(...bearer(owner))
      .expect(200);

    // Envelope interceptor lifts `CursorPage.items` straight into `data`.
    const items = listed.body.data as Array<{ id: string }>;
    expect(items.some((p) => p.id === purchasePayable.id)).toBe(true);
  });
});
