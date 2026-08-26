import request from 'supertest';
import { FinancialAccountType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { RecordManureSaleUseCase } from 'src/modules/sales/application/use-cases/sell-manure/record-manure-sale.use-case';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-368 — `GET /sales` v2: cursor, filters, payment-status projection,
 * `INV-` numbering (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.9, §6.4). Proves
 * the ticket's own core AC: `paymentStatus` is a real SQL `where`, verified
 * by an **equivalence e2e** against `ReceivableService.getStatus` — the
 * exact guard the ticket's own AC text calls for.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales — GET /sales v2 (e2e, RAKHAL-368)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let recordManureSale: RecordManureSaleUseCase;
  let receivableService: ReceivableService;
  let ownerUserId: string;
  let cashAccountId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    recordManureSale = ctx.app.get(RecordManureSaleUseCase);
    receivableService = ctx.app.get(ReceivableService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

    const accountRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: `E2E-368-Cash-${Date.now()}`,
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    cashAccountId = (accountRes.body as { data: { id: string } }).data.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function recordSale(opts: {
    totalAmount: number;
    amountReceived?: number;
  }) {
    return recordManureSale.execute(owner.farmId, ownerUserId, {
      totalAmount: opts.totalAmount,
      amountReceived: opts.amountReceived,
      financialAccountId:
        opts.amountReceived && opts.amountReceived > 0
          ? cashAccountId
          : undefined,
      saleDate: new Date().toISOString(),
      notes: `E2E-368-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    });
  }

  it('a newly created sale gets an INV-NNNNNN number', async () => {
    const { sale } = await recordSale({
      totalAmount: 500,
      amountReceived: 500,
    });
    expect(sale.saleNumber).toMatch(/^INV-\d{6}$/);
  });

  it('paymentStatus is SQL-filtered and matches ReceivableService.getStatus for every state', async () => {
    const paid = await recordSale({ totalAmount: 1000, amountReceived: 1000 });
    const partial = await recordSale({
      totalAmount: 1000,
      amountReceived: 400,
    });
    const unpaid = await recordSale({ totalAmount: 1000 });
    const overdue = await recordSale({ totalAmount: 1000 });

    // Backdate the overdue receivable's dueDate — no use case exposes a
    // dueDate input for manure sales (RD-058), so this is the only way to
    // construct a genuinely OVERDUE fixture.
    await prisma.receivable.update({
      where: { id: overdue.receivableId },
      data: { dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const fixtures: Array<{
      saleId: string;
      receivableId: string;
      expected: string;
    }> = [
      {
        saleId: paid.sale.id,
        receivableId: paid.receivableId,
        expected: 'PAID',
      },
      {
        saleId: partial.sale.id,
        receivableId: partial.receivableId,
        expected: 'PARTIALLY_PAID',
      },
      {
        saleId: unpaid.sale.id,
        receivableId: unpaid.receivableId,
        expected: 'UNPAID',
      },
      {
        saleId: overdue.sale.id,
        receivableId: overdue.receivableId,
        expected: 'OVERDUE',
      },
    ];

    // Sanity: the real derivation agrees with the fixture's intended state.
    for (const f of fixtures) {
      const realStatus = await receivableService.getStatus(
        owner.farmId,
        f.receivableId,
      );
      expect(realStatus).toBe(f.expected);
    }

    // Equivalence: for each status bucket, GET /sales?paymentStatus=X
    // contains exactly the fixtures expected there, and no other fixture.
    for (const status of ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE']) {
      const res = await request(server())
        .get(api(`/sales?paymentStatus=${status}&limit=100`))
        .set(...bearer(owner))
        .expect(200);
      const body = res.body as {
        data: Array<{ id: string; paymentStatus: string }>;
      };

      for (const row of body.data) {
        expect(row.paymentStatus).toBe(status);
      }

      const ids = body.data.map((r) => r.id);
      for (const f of fixtures) {
        if (f.expected === status) {
          expect(ids).toContain(f.saleId);
        } else {
          expect(ids).not.toContain(f.saleId);
        }
      }
    }
  });

  it('DRAFT sales are excluded by default and included with includeDrafts=true', async () => {
    const draftRes = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: 'MANURE',
            description: 'Draft manure line',
            quantity: 1,
            unitPrice: 100,
            manureNotes: 'draft',
          },
        ],
      })
      .expect(201);
    const draftSale = (
      draftRes.body as { data: { id: string; status: string } }
    ).data;
    expect(draftSale.status).toBe(SaleStatus.DRAFT);

    const withoutDrafts = await request(server())
      .get(api('/sales?limit=100'))
      .set(...bearer(owner))
      .expect(200);
    const withoutIds = (
      withoutDrafts.body as { data: Array<{ id: string }> }
    ).data.map((r) => r.id);
    expect(withoutIds).not.toContain(draftSale.id);

    const withDrafts = await request(server())
      .get(api('/sales?limit=100&includeDrafts=true'))
      .set(...bearer(owner))
      .expect(200);
    const withIds = (
      withDrafts.body as { data: Array<{ id: string }> }
    ).data.map((r) => r.id);
    expect(withIds).toContain(draftSale.id);
  });

  it('lineType filters to MANURE-only rows', async () => {
    const { sale } = await recordSale({
      totalAmount: 250,
      amountReceived: 250,
    });
    const res = await request(server())
      .get(api('/sales?lineType=MANURE&limit=100'))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: Array<{ id: string; lineSummary: { type: string | null } }>;
    };
    const found = body.data.find((r) => r.id === sale.id);
    expect(found).toBeDefined();
    expect(found?.lineSummary.type).toBe('MANURE');
  });

  it('cursor pagination shape is present', async () => {
    const res = await request(server())
      .get(api('/sales?limit=1'))
      .set(...bearer(owner))
      .expect(200);
    const body = res.body as {
      data: unknown[];
      meta: { limit: number; hasNextPage: boolean };
    };
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.limit).toBe(1);
    expect(typeof body.meta.hasNextPage).toBe('boolean');
  });
});
