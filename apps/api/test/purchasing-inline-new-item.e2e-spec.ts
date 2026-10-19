import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * Business UX Phase 2 — purchasing correctness. Proves against the real DB + HTTP surface:
 *
 * - a purchase line can carry `newItem` instead of an existing item id: the item is created with ZERO
 *   opening stock in the purchase's own transaction, then the normal lot path adds exactly the
 *   purchased quantity, and the journal debits Inventory (1200) for the whole total;
 * - a failure after the item is created rolls the new item back with the purchase;
 * - the line shape (exactly one of the three ids or `newItem`, nutrition for FEED, a visible unit);
 * - the post-commit Activity Log write is non-fatal, and the entry names the items it created;
 * - an archived supplier is rejected;
 * - supplier create / update / archive write Activity Log entries;
 * - `POST /inventory/medicines/:id/adjust-stock` refuses reason PURCHASE;
 * - `GET /purchasing/purchases` rows carry `paymentStatus` / `outstanding` / `paidAmount`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — inline new item + correctness (e2e, Business UX Phase 2)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let unitId: string;
  let ingredientId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextYear = () => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString();
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const unit = await prisma.unit.findFirstOrThrow({
      where: { farmId: null, deletedAt: null },
      select: { id: true },
    });
    unitId = unit.id;
    const ingredient = await prisma.feedIngredient.findFirstOrThrow({
      select: { id: true },
    });
    ingredientId = ingredient.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Debit posted to Inventory (1200) by this purchase's journal; also asserts the journal balances. */
  async function inventoryDebitFor(purchaseId: string): Promise<number> {
    const ledger = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '1200' },
      select: { id: true },
    });
    const journal = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'PURCHASE',
        sourceId: purchaseId,
      },
      include: { entries: true },
    });
    const allDebit = journal.entries.reduce((s, e) => s + Number(e.debit), 0);
    const allCredit = journal.entries.reduce((s, e) => s + Number(e.credit), 0);
    expect(allDebit).toBe(allCredit);
    return journal.entries
      .filter((e) => e.ledgerAccountId === ledger.id)
      .reduce((s, e) => s + Number(e.debit), 0);
  }

  const post = (body: Record<string, unknown>) =>
    request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({ purchaseDate: new Date().toISOString(), ...body });

  it('MEDICINE newItem: item born with zero stock, lot adds exactly the quantity, journal Dr 1200', async () => {
    const name = unique('E2E-P2-Med');
    const res = await post({
      lines: [
        {
          newItem: {
            kind: 'MEDICINE',
            name,
            unitId,
            medicineType: 'LIQUID',
            medicineCategory: 'ANTIBIOTIC',
          },
          quantity: 8,
          unitCost: 125,
          expiryDate: nextYear(),
          batchCode: 'P2-LOT-1',
        },
      ],
    });
    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      id: string;
      totalAmount: string;
      lines: { medicineId: string | null; medicineBatchId: string | null }[];
    };
    expect(purchase.totalAmount).toBe('1000');
    const medicineId = purchase.lines[0].medicineId!;
    expect(medicineId).toBeTruthy();
    expect(purchase.lines[0].medicineBatchId).toBeTruthy();

    const medicine = await prisma.medicine.findFirstOrThrow({
      where: { id: medicineId, farmId: owner.farmId },
      include: { batches: true },
    });
    expect(medicine.name).toBe(name);
    expect(medicine.currentStock).toBe(8); // not 16: no opening stock
    expect(medicine.batches).toHaveLength(1);
    expect(medicine.batches[0].currentStock).toBe(8);
    expect(medicine.batches[0].costPerUnit).toBe(125);

    expect(await inventoryDebitFor(purchase.id)).toBe(1000);
  });

  it('FEED newItem (copying a catalogue ingredient): one lot, stock = quantity, journal Dr 1200', async () => {
    const name = unique('E2E-P2-Feed');
    const res = await post({
      lines: [
        {
          newItem: {
            kind: 'FEED',
            name,
            unitId,
            feedClass: 'CONCENTRATE',
            ingredientId,
          },
          quantity: 40,
          unitCost: 30,
        },
      ],
    });
    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      id: string;
      lines: { feedItemId: string | null; feedItemBatchId: string | null }[];
    };
    const feedItemId = purchase.lines[0].feedItemId!;
    const item = await prisma.feedItem.findFirstOrThrow({
      where: { id: feedItemId, farmId: owner.farmId },
      include: { batches: true },
    });
    expect(item.name).toBe(name);
    expect(item.batches).toHaveLength(1);
    expect(item.batches[0].currentStock).toBe(40);
    expect(item.batches[0].costPerUnit).toBe(30);
    expect(item.defaultNutritionProfileId).toBeTruthy();
    expect(await inventoryDebitFor(purchase.id)).toBe(1200);
  });

  it('EQUIPMENT newItem: stock = quantity and one audited PURCHASE movement', async () => {
    const name = unique('E2E-P2-Equip');
    const res = await post({
      lines: [
        {
          newItem: { kind: 'EQUIPMENT', name, unitId },
          quantity: 3,
          unitCost: 500,
        },
      ],
    });
    expect(res.status).toBe(201);
    const purchase = res.body.data as {
      id: string;
      lines: { equipmentId: string | null }[];
    };
    const equipmentId = purchase.lines[0].equipmentId!;
    const equipment = await prisma.equipment.findFirstOrThrow({
      where: { id: equipmentId, farmId: owner.farmId },
    });
    expect(equipment.name).toBe(name);
    expect(equipment.currentStock).toBe(3);
    const movements = await prisma.equipmentStockMovement.findMany({
      where: { equipmentId },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].delta).toBe(3);
    expect(movements[0].reason).toBe('PURCHASE');
    expect(await inventoryDebitFor(purchase.id)).toBe(1500);
  });

  it('an existing item and a new item can share one purchase', async () => {
    const first = await post({
      lines: [
        {
          newItem: { kind: 'EQUIPMENT', name: unique('E2E-P2-Base'), unitId },
          quantity: 1,
          unitCost: 10,
        },
      ],
    });
    const existingEquipmentId = (
      first.body.data as { lines: { equipmentId: string }[] }
    ).lines[0].equipmentId;

    const res = await post({
      lines: [
        { equipmentId: existingEquipmentId, quantity: 2, unitCost: 10 },
        {
          newItem: { kind: 'EQUIPMENT', name: unique('E2E-P2-Mixed'), unitId },
          quantity: 5,
          unitCost: 20,
        },
      ],
    });
    expect(res.status).toBe(201);
    const purchase = res.body.data as { id: string; totalAmount: string };
    expect(purchase.totalAmount).toBe('120');
    const stock = await prisma.equipment.findFirstOrThrow({
      where: { id: existingEquipmentId },
      select: { currentStock: true },
    });
    expect(stock.currentStock).toBe(3);
    expect(await inventoryDebitFor(purchase.id)).toBe(120);
  });

  it('rolls the new item back when the purchase fails after it was created', async () => {
    const name = unique('E2E-P2-Rollback');
    const res = await post({
      lines: [
        {
          newItem: { kind: 'EQUIPMENT', name, unitId },
          quantity: 2,
          unitCost: 100,
        },
      ],
      paidAmount: 100,
      // Fails in the payment step, which runs AFTER the lines were written.
      financialAccountId: 'does-not-exist',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(
      await prisma.equipment.count({ where: { farmId: owner.farmId, name } }),
    ).toBe(0);
  });

  describe('line shape', () => {
    it('rejects newItem together with an existing item id', async () => {
      const equipment = await prisma.equipment.findFirstOrThrow({
        where: { farmId: owner.farmId },
        select: { id: true },
      });
      const res = await post({
        lines: [
          {
            equipmentId: equipment.id,
            newItem: { kind: 'EQUIPMENT', name: unique('E2E-P2-Both'), unitId },
            quantity: 1,
            unitCost: 1,
          },
        ],
      });
      expect(res.status).toBe(400);
    });

    it('rejects a new FEED item with neither nutrition nor an ingredient', async () => {
      const name = unique('E2E-P2-NoNutrition');
      const res = await post({
        lines: [
          {
            newItem: { kind: 'FEED', name, unitId, feedClass: 'CONCENTRATE' },
            quantity: 1,
            unitCost: 1,
          },
        ],
      });
      expect(res.status).toBe(400);
      expect(
        await prisma.feedItem.count({ where: { farmId: owner.farmId, name } }),
      ).toBe(0);
    });

    it('rejects a new MEDICINE without type/category/expiry', async () => {
      const res = await post({
        lines: [
          {
            newItem: {
              kind: 'MEDICINE',
              name: unique('E2E-P2-BadMed'),
              unitId,
            },
            quantity: 1,
            unitCost: 1,
          },
        ],
      });
      expect(res.status).toBe(400);
    });

    it('rejects a unit that does not exist for this farm', async () => {
      const name = unique('E2E-P2-BadUnit');
      const res = await post({
        lines: [
          {
            newItem: { kind: 'EQUIPMENT', name, unitId: 'no-such-unit' },
            quantity: 1,
            unitCost: 1,
          },
        ],
      });
      expect(res.status).toBe(400);
      expect(
        await prisma.equipment.count({ where: { farmId: owner.farmId, name } }),
      ).toBe(0);
    });
  });

  describe('Activity Log', () => {
    it('"Purchase Recorded" names the items the purchase created', async () => {
      const name = unique('E2E-P2-Audit');
      const res = await post({
        lines: [
          {
            newItem: { kind: 'EQUIPMENT', name, unitId },
            quantity: 1,
            unitCost: 50,
          },
        ],
      });
      expect(res.status).toBe(201);
      const entry = await prisma.activityLog.findFirst({
        where: {
          farmId: owner.farmId,
          eventTitle: 'Purchase Recorded',
          actionDetails: { contains: name },
        },
      });
      expect(entry).not.toBeNull();
      expect(Number(entry!.financialImpact)).toBe(-50);
    });

    it('a failing audit write does not turn a committed purchase into a 500', async () => {
      const activity = ctx.app.get(ActivityLogService);
      const spy = jest
        .spyOn(activity, 'record')
        .mockRejectedValueOnce(new Error('audit store down'));
      const name = unique('E2E-P2-AuditDown');
      const res = await post({
        lines: [
          {
            newItem: { kind: 'EQUIPMENT', name, unitId },
            quantity: 1,
            unitCost: 5,
          },
        ],
      });
      spy.mockRestore();
      expect(res.status).toBe(201);
      expect(
        await prisma.equipment.count({ where: { farmId: owner.farmId, name } }),
      ).toBe(1);
    });

    it('a failing audit write does not turn a committed expense into a 500', async () => {
      const activity = ctx.app.get(ActivityLogService);
      const spy = jest
        .spyOn(activity, 'record')
        .mockRejectedValueOnce(new Error('audit store down'));
      const description = unique('E2E-P2-ExpenseAuditDown');
      const res = await request(server())
        .post(api('/purchasing/expenses'))
        .set(...bearer(owner))
        .send({
          category: 'UTILITIES',
          description,
          amount: 10,
          expenseDate: new Date().toISOString(),
        });
      spy.mockRestore();
      expect(res.status).toBe(201);
      expect(
        await prisma.expense.count({
          where: { farmId: owner.farmId, description },
        }),
      ).toBe(1);
    });

    it('supplier create / update / archive each write an entry', async () => {
      const name = unique('E2E-P2-Supplier');
      const created = await request(server())
        .post(api('/settings/suppliers'))
        .set(...bearer(owner))
        .send({ name })
        .expect(201);
      const id = (created.body.data as { id: string }).id;

      await request(server())
        .patch(api(`/settings/suppliers/${id}`))
        .set(...bearer(owner))
        .send({ phone: '01700000000' })
        .expect(200);
      await request(server())
        .delete(api(`/settings/suppliers/${id}`))
        .set(...bearer(owner))
        .expect(200);

      const titles = (
        await prisma.activityLog.findMany({
          where: { farmId: owner.farmId, actionDetails: { contains: name } },
          select: { eventTitle: true },
        })
      ).map((e) => e.eventTitle);
      expect(titles).toEqual(
        expect.arrayContaining([
          'Supplier Added',
          'Supplier Updated',
          'Supplier Archived',
        ]),
      );
    });
  });

  it('an archived supplier is rejected on a purchase and on an expense', async () => {
    const supplier = await prisma.supplier.create({
      data: {
        farmId: owner.farmId,
        name: unique('E2E-P2-ArchivedSupplier'),
        deletedAt: new Date(),
      },
    });
    const purchase = await post({
      supplierId: supplier.id,
      lines: [
        {
          newItem: { kind: 'EQUIPMENT', name: unique('E2E-P2-Arch'), unitId },
          quantity: 1,
          unitCost: 1,
        },
      ],
    });
    expect(purchase.status).toBe(400);

    const expense = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'UTILITIES',
        description: unique('E2E-P2-ArchivedExpense'),
        amount: 10,
        expenseDate: new Date().toISOString(),
        supplierId: supplier.id,
      });
    expect(expense.status).toBe(400);
  });

  it('manual medicine adjust-stock refuses reason PURCHASE (no finance posting) but still allows ADJUSTMENT', async () => {
    const created = await post({
      lines: [
        {
          newItem: {
            kind: 'MEDICINE',
            name: unique('E2E-P2-Adjust'),
            unitId,
            medicineType: 'TABLET',
            medicineCategory: 'VITAMIN',
          },
          quantity: 10,
          unitCost: 5,
          expiryDate: nextYear(),
        },
      ],
    });
    const medicineId = (
      created.body.data as { lines: { medicineId: string }[] }
    ).lines[0].medicineId;

    await request(server())
      .post(api(`/inventory/medicines/${medicineId}/adjust-stock`))
      .set(...bearer(owner))
      .send({ adjustment: 5, reason: 'PURCHASE' })
      .expect(400);
    await request(server())
      .post(api(`/inventory/medicines/${medicineId}/adjust-stock`))
      .set(...bearer(owner))
      .send({ adjustment: 5, reason: 'ADJUSTMENT' })
      .expect(201);
  });

  it('list rows carry paymentStatus / outstanding / paidAmount, and a voided purchase leaves payables', async () => {
    const supplier = await prisma.supplier.create({
      data: { farmId: owner.farmId, name: unique('E2E-P2-ListSupplier') },
    });
    const mk = (extra: Record<string, unknown>) =>
      post({
        supplierId: supplier.id,
        lines: [
          {
            newItem: { kind: 'EQUIPMENT', name: unique('E2E-P2-List'), unitId },
            quantity: 10,
            unitCost: 100,
          },
        ],
        ...extra,
      });

    const full = (await mk({ paidAmount: 1000 })).body.data as { id: string };
    const part = (await mk({ paidAmount: 400 })).body.data as { id: string };
    const credit = (await mk({})).body.data as { id: string };

    const list = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ supplierId: supplier.id })
      .set(...bearer(owner))
      .expect(200);
    const rows = new Map(
      (
        list.body.data as {
          id: string;
          paymentStatus: string | null;
          outstanding: string;
          paidAmount: string;
        }[]
      ).map((r) => [r.id, r]),
    );

    expect(rows.get(full.id)).toMatchObject({
      paymentStatus: 'PAID',
      outstanding: '0.00',
      paidAmount: '1000.00',
    });
    expect(rows.get(part.id)).toMatchObject({
      paymentStatus: 'UNPAID',
      outstanding: '600.00',
      paidAmount: '400.00',
    });
    expect(rows.get(credit.id)).toMatchObject({
      paymentStatus: 'UNPAID',
      outstanding: '1000.00',
      paidAmount: '0.00',
    });

    await request(server())
      .post(api(`/purchasing/purchases/${credit.id}/void`))
      .set(...bearer(owner))
      .expect((r) => expect([200, 201]).toContain(r.status));
    const after = await request(server())
      .get(api('/purchasing/purchases'))
      .query({ supplierId: supplier.id })
      .set(...bearer(owner))
      .expect(200);
    const voidedRow = (
      after.body.data as {
        id: string;
        paymentStatus: string | null;
        outstanding: string;
      }[]
    ).find((r) => r.id === credit.id);
    expect(voidedRow?.paymentStatus).toBeNull();
    expect(voidedRow?.outstanding).toBe('0.00');

    const payables = await request(server())
      .get(api('/purchasing/payables'))
      .query({ supplierId: supplier.id })
      .set(...bearer(owner))
      .expect(200);
    expect(
      (payables.body.data as { purchaseId: string | null }[]).map(
        (p) => p.purchaseId,
      ),
    ).not.toContain(credit.id);
  });
});
