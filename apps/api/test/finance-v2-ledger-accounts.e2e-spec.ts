import request from 'supertest';
import { LedgerAccountCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from 'src/modules/finance-v2/ledger/domain/default-chart-of-accounts';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { createTestApp, TestContext } from './utils/e2e';

/**
 * RAKHAL-333 — `LedgerAccount` chart of accounts + per-farm seeding
 * (`FINANCE_V2_DESIGN.md` §4.4). Proves the ticket's own AC: a brand-new farm,
 * created through the real bootstrap path (`POST /farms` →
 * `FarmService.create`), ends up with the complete default chart of accounts
 * — every row `isSystem: true` — with no HTTP route ever exposing the chart
 * itself (internal only, per AC #3). Uses a freshly registered user (not the
 * seeded demo owner, who already has a farm + chart from a prior run) so this
 * spec exercises the actual bootstrap hook, not a pre-seeded fixture.
 */
describe('Finance V2 — LedgerAccount chart of accounts (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const registeredFarmIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    // Best-effort local cleanup — new users/farms this spec created. Ledger
    // accounts cascade-delete with the farm's FK (`onDelete: Restrict` is not
    // set on the reverse — Farm delete cascades via Prisma's own relation
    // semantics is out of scope here; deleting the farm rows is sufficient
    // for this spec, ledger accounts are removed by the DB's own FK cascade
    // configured on `LedgerAccount.farm`).
    for (const farmId of registeredFarmIds) {
      await prisma.ledgerAccount
        .deleteMany({ where: { farmId } })
        .catch(() => undefined);
      await prisma.farmMember
        .deleteMany({ where: { farmId } })
        .catch(() => undefined);
      await prisma.farm
        .delete({ where: { id: farmId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  /** Register a fresh user, accept legal consent, log in with a bootstrap token. */
  async function registerConsentedUser(): Promise<{ token: string }> {
    const email = `rakhal-333-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.rakhal.test`;
    const password = 'LedgerTest123';

    await request(server())
      .post(api('/auth/register'))
      .send({ email, name: 'Ledger Test Owner', password })
      .expect(201);

    const bootstrapLogin = await request(server())
      .post(api('/auth/login'))
      .send({ email, password, farmId: 'bootstrap' })
      .expect(201);
    const token = (bootstrapLogin.body as { data: { accessToken: string } })
      .data.accessToken;

    await request(server())
      .post(api('/legal/consent'))
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    return { token };
  }

  it('a newly bootstrapped farm has the complete, balanced-capable chart of accounts', async () => {
    const { token } = await registerConsentedUser();

    const createRes = await request(server())
      .post(api('/farms'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Ledger Test Farm ${Date.now()}` })
      .expect(201);
    const farmId = (createRes.body as { data: { id: string } }).data.id;
    expect(farmId).toBeTruthy();
    registeredFarmIds.push(farmId);

    const accounts = await prisma.ledgerAccount.findMany({
      where: { farmId },
      orderBy: { code: 'asc' },
    });

    // Every default account exists, with the right category, and is system-owned.
    expect(accounts).toHaveLength(DEFAULT_CHART_OF_ACCOUNTS.length);
    for (const expected of DEFAULT_CHART_OF_ACCOUNTS) {
      const actual = accounts.find((a) => a.code === expected.code);
      expect(actual).toBeDefined();
      expect(actual?.name).toBe(expected.name);
      expect(actual?.category).toBe(expected.category);
      expect(actual?.isSystem).toBe(true);
    }

    // Balanced-capable: at least one account in every category a double-entry
    // posting needs (asset debit, revenue/liability/equity credit, expense debit).
    const categories = new Set(accounts.map((a) => a.category));
    expect(categories).toEqual(
      new Set([
        LedgerAccountCategory.ASSET,
        LedgerAccountCategory.LIABILITY,
        LedgerAccountCategory.EQUITY,
        LedgerAccountCategory.REVENUE,
        LedgerAccountCategory.EXPENSE,
      ]),
    );

    // Unique per farm+code: re-running the seed for the same farm is a no-op,
    // never a duplicate row (createMany's skipDuplicates in
    // `LedgerAccountService.seedDefaultChart`).
    const ledgerAccounts = ctx.app.get(LedgerAccountService);
    await ledgerAccounts.seedDefaultChart(farmId);
    const afterReseed = await prisma.ledgerAccount.findMany({
      where: { farmId },
    });
    expect(afterReseed).toHaveLength(DEFAULT_CHART_OF_ACCOUNTS.length);
  });

  it('never exposes the chart of accounts over HTTP (internal only)', async () => {
    const { token } = await registerConsentedUser();
    const createRes = await request(server())
      .post(api('/farms'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `No Route Farm ${Date.now()}` })
      .expect(201);
    const farmId = (createRes.body as { data: { id: string } }).data.id;
    registeredFarmIds.push(farmId);

    // No `/finance-v2/**`, `/ledger/**` or `/ledger-accounts` route exists —
    // every guess 404s (route not found), never 200 with ledger data.
    for (const guess of [
      '/finance-v2/ledger-accounts',
      '/finance-v2/ledger/accounts',
      '/ledger-accounts',
      '/ledger/accounts',
    ]) {
      const res = await request(server())
        .get(api(guess))
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    }
  });
});
