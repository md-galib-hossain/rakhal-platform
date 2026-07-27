import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-010(c) — Finance transactions CSV export. `GET /finance/transactions/export`
 * reuses the ledger's own filters (category/status/date-range/search) but
 * returns every matching row (no cursor pagination) as a CSV file, rendered
 * through the Reports engine's generic `renderCsv`/`ReportData` (no new
 * dependency, no XLSX — CSV opens fine in any spreadsheet app).
 *
 * Creates its own isolated `FinanceTransaction` rows via the real API (a
 * unique `entityName` marker to filter on) rather than mutating shared seeded
 * finance data, since e2e suites run in parallel Jest workers against one
 * shared dev DB.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance — transactions CSV export (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns a CSV file containing a just-recorded transaction', async () => {
    const marker = `E2E-EXPORT-${Date.now()}`;

    await request(server())
      .post(api('/finance/transactions'))
      .set(...auth(owner))
      .send({
        type: 'OPERATING_EXPENSE',
        category: 'OVERHEAD',
        entityName: marker,
        amount: 1234.5,
      })
      .expect(201);

    const res = await request(server())
      .get(api('/finance/transactions/export'))
      .set(...auth(owner))
      .query({ search: marker })
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toMatch(
      /filename="finance-transactions-.*\.csv"/,
    );

    const csv = res.text;
    expect(csv).toContain('Finance Transactions Export');
    expect(csv).toContain('Date,Reference,Type,Category');
    expect(csv).toContain(marker);
    expect(csv).toContain('1234.5');
  });

  it('respects the category/status filters, excluding non-matching rows', async () => {
    const marker = `E2E-EXPORT-FILTER-${Date.now()}`;

    await request(server())
      .post(api('/finance/transactions'))
      .set(...auth(owner))
      .send({
        type: 'REVENUE',
        category: 'REVENUE',
        entityName: marker,
        amount: 500,
      })
      .expect(201);

    const wrongCategory = await request(server())
      .get(api('/finance/transactions/export'))
      .set(...auth(owner))
      .query({ search: marker, category: 'OVERHEAD' })
      .expect(200);
    expect(wrongCategory.text).not.toContain(marker);

    const rightCategory = await request(server())
      .get(api('/finance/transactions/export'))
      .set(...auth(owner))
      .query({ search: marker, category: 'REVENUE' })
      .expect(200);
    expect(rightCategory.text).toContain(marker);
  });

  it('a worker without finance.read is forbidden', async () => {
    const worker = await loginAs(
      ctx,
      'worker@demo.rakhal.test',
      'WorkerPass123',
    );
    const workerPerms = await prisma.rolePermission.findMany({
      where: { role: { name: 'Worker' } },
      include: { permission: true },
    });
    const hasFinanceRead = workerPerms.some(
      (p) => p.permission.name === 'finance.read',
    );
    // Guard the test's own premise: if seed data ever grants Worker finance.read,
    // this assertion (not the export route) needs updating, not silently skipping.
    expect(hasFinanceRead).toBe(false);

    await request(server())
      .get(api('/finance/transactions/export'))
      .set(...auth(worker))
      .expect(403);
  });
});
