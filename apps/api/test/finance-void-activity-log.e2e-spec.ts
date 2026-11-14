import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Voiding an expense, a purchase or a sale writes a `FINANCE` Activity Log entry (the recording
 * side already did; the reversal used to leave no trace). Entries are matched by a per-run unique
 * description so the shared, hash-chained dev-DB log can't cause false matches.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance voids → Activity Log (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const run = Date.now();

  interface LogRow {
    eventTitle: string;
    actionDetails: string;
    module: string;
    actorType: string;
    financialImpact: string | number | null;
  }

  async function financeLog(): Promise<LogRow[]> {
    const res = await request(server())
      .get(api('/activity-log?module=FINANCE&limit=100'))
      .set(...auth(owner))
      .expect(200);
    return res.body.data as LogRow[];
  }

  const matching = async (eventTitle: string, needle: string) =>
    (await financeLog()).filter(
      (r) => r.eventTitle === eventTitle && r.actionDetails.includes(needle),
    );

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logs an expense void once, with the reversed amount as a positive impact', async () => {
    const description = `E2E-VOID-EXPENSE-${run}`;
    const created = await request(server())
      .post(api('/purchasing/expenses'))
      .set(...auth(owner))
      .send({
        category: 'UTILITIES',
        description,
        amount: 123,
        expenseDate: new Date().toISOString(),
      })
      .expect(201);
    const id = created.body.data.id as string;
    expect(await matching('Expense Recorded', description)).toHaveLength(1);

    await request(server())
      .post(api(`/purchasing/expenses/${id}/void`))
      .set(...auth(owner))
      .expect(201);

    const rows = await matching('Expense Voided', description);
    expect(rows).toHaveLength(1);
    expect(rows[0].module).toBe('FINANCE');
    expect(rows[0].actorType).toBe('user');
    expect(rows[0].actionDetails).toContain('123');
    expect(Number(rows[0].financialImpact)).toBe(123);

    // A rejected repeat void must not write a second entry.
    await request(server())
      .post(api(`/purchasing/expenses/${id}/void`))
      .set(...auth(owner))
      .expect(400);
    expect(await matching('Expense Voided', description)).toHaveLength(1);
  });

  it('logs a purchase void with the purchase number and destocked line count', async () => {
    const medicine = await request(server())
      .post(api('/inventory/medicines'))
      .set(...auth(owner))
      .send({
        name: `E2E-VOID-PURCHASE-MED-${run}`,
        type: 'LIQUID',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 0,
        costPerUnit: 5,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(201);

    const purchase = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...auth(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            medicineId: medicine.body.data.id,
            quantity: 4,
            unitCost: 25,
            expiryDate: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            batchCode: `VOID-${run}`,
          },
        ],
      })
      .expect(201);
    const number = purchase.body.data.purchaseNumber as string;
    const id = purchase.body.data.id as string;

    await request(server())
      .post(api(`/purchasing/purchases/${id}/void`))
      .set(...auth(owner))
      .expect(201);

    const rows = await matching('Purchase Voided', number);
    expect(rows).toHaveLength(1);
    expect(rows[0].module).toBe('FINANCE');
    expect(rows[0].actionDetails).toContain('1 line(s) destocked');
    expect(Number(rows[0].financialImpact)).toBe(100);
  });

  it('logs a sale cancel with the sale number and a negative impact', async () => {
    // A manure sale is confirmed on creation (a plain `POST /sales` only makes a DRAFT, which
    // `VoidSale` rejects as "never confirmed"). Left unpaid so it is cancellable, not refundable.
    const res = await request(server())
      .post(api('/sales/manure'))
      .set(...auth(owner))
      .send({
        saleDate: new Date().toISOString(),
        totalAmount: 100,
        notes: `E2E-VOID-SALE-${run}`,
      })
      .expect(201);
    const sale = (res.body.data.sale ?? res.body.data) as {
      id: string;
      saleNumber: string;
    };
    const number = sale.saleNumber;
    const id = sale.id;

    await request(server())
      .post(api(`/sales/${id}/cancel`))
      .set(...auth(owner))
      .expect(201);

    const rows = await matching('Sale Cancelled', number);
    expect(rows).toHaveLength(1);
    expect(rows[0].module).toBe('FINANCE');
    expect(rows[0].actionDetails).toContain('cancelled');
    expect(Number(rows[0].financialImpact)).toBe(-100);
  });
});
