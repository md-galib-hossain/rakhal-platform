import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { AuthedUser, bearer, createTestApp, TestContext } from './utils/e2e';

/**
 * RAKHAL-369 (MILESTONE 22, `BUSINESS_IA_PRD.md` §6.3, §9.3) — receivable/
 * payable aging. Proves the ticket's own AC against the real DB + HTTP
 * surface:
 *
 * - `GET /finance/receivables/aging` and `GET /purchasing/payables/aging`
 *   bucket open documents by `daysPastDue = max(0, asOf - dueDate)` into
 *   `CURRENT` (0–7)/`OVERDUE_8_30`/`OVERDUE_31_PLUS`;
 * - a `dueDate: null` document is always `CURRENT`;
 * - a fully-paid document (outstanding == 0) is excluded entirely — aging
 *   only ever reports open documents;
 * - `totalOutstanding`/`totalCount` sum across every bucket;
 * - `asOf` is respected (a document that was OVERDUE_8_30 "today" reports
 *   CURRENT when queried with an earlier `asOf`).
 *
 * Runs on a **fresh, empty farm** (`FarmService.create()`) rather than the
 * shared demo farm every other e2e suite writes to — aging is a whole-
 * population aggregate, so asserting exact bucket totals against a farm
 * other suites are concurrently mutating would be flaky by construction.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Business Reporting — Receivable/Payable aging (e2e, RAKHAL-369)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };

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
      name: unique('E2E-369-AgingFarm'),
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
    owner = {
      token: login.body.data.accessToken as string,
      farmId,
    };
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createReceivable(
    totalAmount: number,
    dueDate: Date | null,
    paidAmount = 0,
  ): Promise<string> {
    const sale = await prisma.sale.create({
      data: {
        farmId,
        saleNumber: unique('E2E-369-SALE'),
        saleDate: new Date(),
        subtotal: totalAmount,
        totalAmount,
        createdById: ownerUserId,
      },
    });
    const receivable = await prisma.receivable.create({
      data: { farmId, saleId: sale.id, totalAmount, dueDate },
    });
    if (paidAmount > 0) {
      await payOffReceivable(receivable.id, paidAmount);
    }
    return receivable.id;
  }

  async function createPayable(
    totalAmount: number,
    dueDate: Date | null,
  ): Promise<string> {
    const purchase = await prisma.purchase.create({
      data: {
        farmId,
        purchaseNumber: unique('E2E-369-PUR'),
        purchaseDate: new Date(),
        totalAmount,
        createdById: ownerUserId,
      },
    });
    const payable = await prisma.payable.create({
      data: { farmId, purchaseId: purchase.id, totalAmount, dueDate },
    });
    return payable.id;
  }

  async function payOffReceivable(
    receivableId: string,
    amount: number,
  ): Promise<void> {
    const account = await prisma.financialAccount.findFirst({
      where: { farmId, deletedAt: null },
      select: { id: true },
    });
    let accountId = account?.id;
    if (!accountId) {
      const res = await request(server())
        .post(api('/finance/accounts'))
        .set(...bearer(owner))
        .send({ name: 'E2E-369 Cash', type: 'CASH', openingBalance: 0 })
        .expect(201);
      accountId = res.body.data.id as string;
    }
    const payment = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: 'INCOMING',
        financialAccountId: accountId,
        amount,
        method: 'CASH',
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    await request(server())
      .post(
        api(`/finance/payments/${payment.body.data.id as string}/allocations`),
      )
      .set(...bearer(owner))
      .send({ allocations: [{ receivableId, amount }] })
      .expect(201);
  }

  it('buckets receivables by daysPastDue into CURRENT/OVERDUE_8_30/OVERDUE_31_PLUS', async () => {
    await createReceivable(1000, null); // null dueDate -> CURRENT
    await createReceivable(2000, daysAgo(3)); // 3 days -> CURRENT
    await createReceivable(3000, daysAgo(15)); // 15 days -> OVERDUE_8_30
    await createReceivable(4000, daysAgo(45)); // 45 days -> OVERDUE_31_PLUS

    const res = await request(server())
      .get(api('/finance/receivables/aging'))
      .set(...bearer(owner))
      .expect(200);

    const report = res.body.data as {
      buckets: { key: string; amount: string; invoiceCount: number }[];
      totalOutstanding: string;
      totalCount: number;
    };
    const byKey = new Map(report.buckets.map((b) => [b.key, b]));

    expect(byKey.get('CURRENT')?.amount).toBe('3000');
    expect(byKey.get('CURRENT')?.invoiceCount).toBe(2);
    expect(byKey.get('OVERDUE_8_30')?.amount).toBe('3000');
    expect(byKey.get('OVERDUE_8_30')?.invoiceCount).toBe(1);
    expect(byKey.get('OVERDUE_31_PLUS')?.amount).toBe('4000');
    expect(byKey.get('OVERDUE_31_PLUS')?.invoiceCount).toBe(1);
    expect(report.totalOutstanding).toBe('10000');
    expect(report.totalCount).toBe(4);
  });

  it('excludes a fully-paid receivable entirely', async () => {
    const before = await request(server())
      .get(api('/finance/receivables/aging'))
      .set(...bearer(owner))
      .expect(200);
    const beforeCount = (before.body.data as { totalCount: number }).totalCount;

    await createReceivable(500, daysAgo(20), 500); // fully paid

    const after = await request(server())
      .get(api('/finance/receivables/aging'))
      .set(...bearer(owner))
      .expect(200);
    const afterCount = (after.body.data as { totalCount: number }).totalCount;

    expect(afterCount).toBe(beforeCount);
  });

  it('respects asOf — a document overdue "today" reports CURRENT for an earlier asOf', async () => {
    // Fixtures accumulate on this shared farm across tests in this file (by
    // design — see the describe-block doc comment), so bucket amounts are
    // asserted as deltas against a pre-fixture baseline, never as exact
    // totals — an earlier test's rows land in the same bucket otherwise.
    // Each baseline is taken at the SAME asOf as its later comparison query
    // — an earlier receivable's own bucket shifts when asOf shifts (e.g. a
    // dueDate 3 days before "now" is still in the future relative to an
    // asOf 10 days back), so a today-asOf baseline cannot be diffed against
    // an earlier-asOf query.
    const earlierAsOf = daysAgo(10).toISOString();

    const beforeToday = await request(server())
      .get(api('/finance/receivables/aging'))
      .set(...bearer(owner))
      .expect(200);
    const beforeOverdue8_30 = Number(
      (
        beforeToday.body.data as { buckets: { key: string; amount: string }[] }
      ).buckets.find((b) => b.key === 'OVERDUE_8_30')?.amount ?? 0,
    );

    const beforeEarlier = await request(server())
      .get(api(`/finance/receivables/aging?asOf=${earlierAsOf}`))
      .set(...bearer(owner))
      .expect(200);
    const beforeCurrent = Number(
      (
        beforeEarlier.body.data as {
          buckets: { key: string; amount: string }[];
        }
      ).buckets.find((b) => b.key === 'CURRENT')?.amount ?? 0,
    );

    const receivableId = await createReceivable(700, daysAgo(10));

    const asOfToday = await request(server())
      .get(api('/finance/receivables/aging'))
      .set(...bearer(owner))
      .expect(200);
    const todayReport = asOfToday.body.data as {
      buckets: { key: string; amount: string }[];
    };
    const todayOverdue8_30 = Number(
      todayReport.buckets.find((b) => b.key === 'OVERDUE_8_30')?.amount ?? 0,
    );
    expect(todayOverdue8_30 - beforeOverdue8_30).toBe(700);

    const asOfEarlier = await request(server())
      .get(api(`/finance/receivables/aging?asOf=${earlierAsOf}`))
      .set(...bearer(owner))
      .expect(200);
    const earlierReport = asOfEarlier.body.data as {
      buckets: { key: string; amount: string }[];
    };
    const earlierCurrent = Number(
      earlierReport.buckets.find((b) => b.key === 'CURRENT')?.amount ?? 0,
    );
    expect(earlierCurrent - beforeCurrent).toBe(700);

    // receivableId only used to keep the fixture referenced/documented.
    expect(receivableId).toBeTruthy();
  });

  it('GET /purchasing/payables/aging buckets payables the same way', async () => {
    await createPayable(1500, daysAgo(45));

    const res = await request(server())
      .get(api('/purchasing/payables/aging'))
      .set(...bearer(owner))
      .expect(200);

    const report = res.body.data as {
      buckets: { key: string; amount: string; invoiceCount: number }[];
    };
    const bucket = report.buckets.find((b) => b.key === 'OVERDUE_31_PLUS');
    expect(bucket?.amount).toBe('1500');
    expect(bucket?.invoiceCount).toBe(1);
  });
});
