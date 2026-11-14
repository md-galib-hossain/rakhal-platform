import request from 'supertest';
import { FeedClass, FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { createFeedItemWithLot, feedItemStock } from './utils/feed-fixtures';
import { PayableStatus } from 'src/modules/purchasing/domain/payable-status';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * RAKHAL-348 — `Purchase`/`PurchaseLine` + `Payable` (`FINANCE_V2_DESIGN.md`
 * §5.1). Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - the ticket's own worked example: a ৳30,000 feed purchase with ৳20,000
 *   paid from a Bank account raises a Payable of ৳10,000 and increments the
 *   feed item's real stock by the purchased quantity;
 * - a fully-paid-at-creation purchase raises no `Payable` at all;
 * - a fully-unpaid purchase raises a `Payable` equal to the full total;
 * - the journal always balances (proven indirectly via the Payable/stock
 *   assertions plus a direct `JournalEntry` sum check);
 * - line-shape validation (exactly one of medicineId/feedItemId/equipmentId);
 * - RBAC (`purchasing.create`/`purchasing.read`: Owner + Manager, not
 *   Worker).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — Purchase + PurchaseLine + Payable (e2e, RAKHAL-348)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createFeedItem(currentStock = 0) {
    const unit = await prisma.unit.findFirstOrThrow({
      where: { OR: [{ farmId: owner.farmId }, { farmId: null }] },
      select: { id: true },
    });
    const { item } = await createFeedItemWithLot(prisma, {
      farmId: owner.farmId,
      createdBy: ownerUserId,
      name: uniqueName('E2E-348-Feed'),
      feedClass: FeedClass.CONCENTRATE,
      unitId: unit.id,
      stock: currentStock,
      costPerUnit: 10,
    });
    return item;
  }

  async function createBankAccount(): Promise<{
    id: string;
    ledgerAccountId: string;
  }> {
    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('E2E-348-Bank'),
          type: FinancialAccountType.BANK,
          bankDetail: {
            bankName: 'E2E Test Bank',
            accountNumber: uniqueName('ACC'),
          },
        }),
      },
    };
    return res.body.data;
  }

  it("ticket's own worked example: ৳30,000 feed purchase, ৳20,000 paid from Bank → Payable 10,000, inventory +quantity", async () => {
    const feedItem = await createFeedItem(50);
    const bank = await createBankAccount();

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            feedItemId: feedItem.id,
            quantity: 100,
            unitCost: 300,
          },
        ],
        paidAmount: 20000,
        financialAccountId: bank.id,
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      id: string;
      purchaseNumber: string;
      totalAmount: string;
      lines: Array<{ feedItemId: string | null; totalAmount: string }>;
      payable: { id: string; totalAmount: string } | null;
    };

    expect(purchase.purchaseNumber).toMatch(/^PUR-\d{6}$/);
    expect(purchase.totalAmount).toBe('30000');
    expect(purchase.lines).toHaveLength(1);
    expect(purchase.lines[0].feedItemId).toBe(feedItem.id);
    expect(purchase.payable).not.toBeNull();
    expect(purchase.payable?.totalAmount).toBe('10000');

    // Real stock increment — the physical half of "a Purchase increases an
    // inventory asset", atomic with the document + journal + payable.
    expect(await feedItemStock(prisma, feedItem.id)).toBe(150);

    const movement = await prisma.feedItemStockMovement.findFirst({
      where: { feedItemId: feedItem.id, reason: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement?.delta).toBe(100);

    // Payable derived status via the read route.
    const payableRes = await request(server())
      .get(api(`/purchasing/payables/${purchase.payable!.id}`))
      .set(...bearer(owner))
      .expect(200);
    const payableBody = payableRes.body as {
      data: { status: PayableStatus; outstanding: string };
    };
    expect(payableBody.data.status).toBe(PayableStatus.UNPAID);
    expect(Number(payableBody.data.outstanding)).toBe(10000);

    // The journal always balances — sum of debits equals sum of credits for
    // this purchase's own JournalTransaction.
    const journal = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'PURCHASE',
        sourceId: purchase.id,
      },
      include: { entries: true },
    });
    const debitSum = journal.entries.reduce(
      (sum, e) => sum + Number(e.debit),
      0,
    );
    const creditSum = journal.entries.reduce(
      (sum, e) => sum + Number(e.credit),
      0,
    );
    expect(debitSum).toBe(30000);
    expect(creditSum).toBe(30000);
  });

  it('a fully-paid-at-creation purchase raises no Payable', async () => {
    const feedItem = await createFeedItem(0);
    const bank = await createBankAccount();

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 10, unitCost: 50 }],
        paidAmount: 500,
        financialAccountId: bank.id,
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      totalAmount: string;
      payable: unknown;
    };
    expect(purchase.totalAmount).toBe('500');
    expect(purchase.payable).toBeNull();
  });

  it('a fully-unpaid purchase (no paidAmount) raises a Payable for the full total', async () => {
    const feedItem = await createFeedItem(0);

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 20, unitCost: 25 }],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      totalAmount: string;
      payable: { totalAmount: string } | null;
    };
    expect(purchase.totalAmount).toBe('500');
    expect(purchase.payable?.totalAmount).toBe('500');
  });

  it('rejects a purchase line with zero item FKs', async () => {
    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ quantity: 1, unitCost: 100 }],
      });
    expect(res.status).toBe(400);
  });

  it('rejects a purchase line with two item FKs at once', async () => {
    const feedItem = await createFeedItem(0);
    const medicine = await prisma.medicine.findFirst({
      where: { farmId: owner.farmId },
      select: { id: true },
    });
    if (!medicine) return; // seed-dependent, skip if no medicine exists

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            feedItemId: feedItem.id,
            medicineId: medicine.id,
            quantity: 1,
            unitCost: 100,
          },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects paidAmount greater than the computed total', async () => {
    const feedItem = await createFeedItem(0);
    const bank = await createBankAccount();

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 100 }],
        paidAmount: 200,
        financialAccountId: bank.id,
      });
    expect(res.status).toBe(400);
  });

  it("paidAmount > 0 without financialAccountId pays from the farm's single account", async () => {
    const feedItem = await createFeedItem(0);

    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 100 }],
        paidAmount: 50,
      });
    expect(res.status).toBe(201);
  });

  it('GET /purchasing/purchases/:id round-trips the created purchase', async () => {
    const feedItem = await createFeedItem(0);
    const created = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 5, unitCost: 40 }],
      });
    expect(created.status).toBe(201);
    const purchaseId = (created.body.data as { id: string }).id;

    const fetched = await request(server())
      .get(api(`/purchasing/purchases/${purchaseId}`))
      .set(...bearer(owner));
    expect(fetched.status).toBe(200);
    expect((fetched.body.data as { id: string }).id).toBe(purchaseId);
  });

  it('RBAC: Worker cannot create or read purchases, Manager can', async () => {
    const feedItem = await createFeedItem(0);

    const workerCreate = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(worker))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 10 }],
      });
    expect(workerCreate.status).toBe(403);

    const workerRead = await request(server())
      .get(api('/purchasing/purchases'))
      .set(...bearer(worker));
    expect(workerRead.status).toBe(403);

    const managerCreate = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(manager))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: feedItem.id, quantity: 1, unitCost: 10 }],
      });
    expect(managerCreate.status).toBe(201);
  });
});
