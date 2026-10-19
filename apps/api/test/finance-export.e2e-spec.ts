import request from 'supertest';
import type { App } from 'supertest/types';
import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  TestContext,
  bearer,
  createTestApp,
  loginAs,
} from './utils/e2e';

import { createExtraAccount } from './utils/finance';
/**
 * Finance transactions export, async BullMQ job pipeline (`rpt_finance_export`).
 *
 * RAKHAL-354: rewritten off V1's `POST /finance/transactions` (deleted along
 * with `FinanceTransaction`) onto Finance V2's `POST /finance/income`
 * (RAKHAL-350, `OtherIncome` — a real journal posting), matching
 * `report-generators.service.ts#financeExport`'s own rewrite onto
 * `JournalTransaction`. `category`/`entityName`/`Reference` no longer exist
 * as report columns — the filter is now `sourceType` and the search target
 * is `description` (see that method's own doc comment).
 */
describe('Reports — Finance Transactions Export (async)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer() as App;

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdOtherIncomeIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  });

  afterAll(async () => {
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({
        where: {
          sourceId: { in: [...createdOtherIncomeIds, ...createdAccountIds] },
        },
      })
      .catch(() => undefined);
    await prisma.otherIncome
      .deleteMany({ where: { id: { in: createdOtherIncomeIds } } })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  async function pollUntilCompleted(jobId: string): Promise<any> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const res = await request(server())
        .get(`${ctx.prefix}/reports/jobs/${jobId}`)
        .set(...bearer(owner));
      const status = (res.body as { data: { status: string } }).data.status;
      if (status === 'completed' || status === 'failed') {
        return res.body;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(`Report job ${jobId} did not settle within 15s`);
  }

  async function recordOtherIncome(marker: string, amount: number) {
    const accountRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('FinExport-Cash'),
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const account = (
      accountRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const categoriesRes = await request(server())
      .get(api('/finance/income/categories'))
      .set(...bearer(owner))
      .expect(200);
    const category = (categoriesRes.body as { data: Array<{ id: string }> })
      .data[0];

    const incomeRes = await request(server())
      .post(api('/finance/income'))
      .set(...bearer(owner))
      .send({
        categoryId: category.id,
        description: marker,
        amount,
        date: new Date().toISOString(),
        financialAccountId: account.id,
      })
      .expect(201);
    const otherIncome = (incomeRes.body as { data: { id: string } }).data;
    createdOtherIncomeIds.push(otherIncome.id);
    return otherIncome.id;
  }

  it('returns a CSV file containing a just-posted V2 journal transaction', async () => {
    const marker = `E2E-EXPORT-${Date.now()}`;
    const sourceId = await recordOtherIncome(marker, 1234.5);

    const generateRes = await request(server())
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { fromDate: new Date().toISOString().slice(0, 10) },
      });
    expect(generateRes.status).toBe(201);
    const jobId = (generateRes.body as { data: { job_id: string } }).data
      .job_id;

    const settled = await pollUntilCompleted(jobId);
    expect((settled as { data: { status: string } }).data.status).toBe(
      'completed',
    );

    const download = await request(server())
      .get(`${ctx.prefix}/reports/jobs/${jobId}/download`)
      .set(...bearer(owner));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/csv');
    expect(download.text).toContain('Finance Transactions Export');
    expect(download.text).toContain(
      'Date,Source Type,Source Reference,Description,Amount,Status',
    );
    expect(download.text).toContain(sourceId);
    expect(download.text).toContain('1234.5');
  }, 20_000);

  it('respects the sourceType (category) filter, excluding non-matching rows', async () => {
    const marker = `E2E-EXPORT-FILTER-${Date.now()}`;
    const sourceId = await recordOtherIncome(marker, 500);
    const fromDate = new Date().toISOString().slice(0, 10);

    const wrongGenerate = await request(server())
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { fromDate, category: 'SALE' },
      });
    const wrongJobId = (wrongGenerate.body as { data: { job_id: string } }).data
      .job_id;
    const wrongSettled = await pollUntilCompleted(wrongJobId);
    const wrongUrl = (wrongSettled as { data: { download_url: string } }).data
      .download_url;
    const wrongDownload = await request(server())
      .get(wrongUrl)
      .set(...bearer(owner));
    expect(wrongDownload.text).not.toContain(sourceId);

    const rightGenerate = await request(server())
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(owner))
      .send({
        reportId: 'rpt_finance_export',
        format: 'csv',
        parameters: { fromDate, category: 'OTHER_INCOME' },
      });
    const rightJobId = (rightGenerate.body as { data: { job_id: string } }).data
      .job_id;
    const rightSettled = await pollUntilCompleted(rightJobId);
    const rightUrl = (rightSettled as { data: { download_url: string } }).data
      .download_url;
    const rightDownload = await request(server())
      .get(rightUrl)
      .set(...bearer(owner));
    expect(rightDownload.text).toContain(sourceId);
  }, 25_000);

  it('worker is forbidden from generating the export (reports.create is manager+)', async () => {
    const res = await request(server())
      .post(`${ctx.prefix}/reports/generate`)
      .set(...bearer(worker))
      .send({ reportId: 'rpt_finance_export', format: 'csv' });
    expect(res.status).toBe(403);
  });
});
