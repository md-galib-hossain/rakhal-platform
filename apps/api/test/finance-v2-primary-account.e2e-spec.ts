import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * 2026-09-24 (user request: "add make primary option for finance wallet accounts so in each time we
 * dont need to select finance wallet"): a farm has one primary `FinancialAccount` — the payment
 * pickers pre-select it. `PATCH /finance/accounts/:id/primary` moves the flag (clearing the old
 * holder in the same transaction, so there is never more than one), an archived account can't be
 * primary, archiving the primary clears its flag, and it is RBAC-gated like every other account
 * write (`finance.accounts`: Owner/Manager, not Worker).
 *
 * Restores the demo farm's original primary account afterwards (shared dev DB). Requires the dev
 * stack up + `pnpm seed`.
 */
describe('Finance V2 — primary (default) wallet (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let originalPrimaryId: string | undefined;
  const createdAccountIds: string[] = [];
  const createdLedgerIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const listAccounts = async () =>
    (
      await request(server())
        .get(api('/finance/accounts'))
        .set(...auth(owner))
        .expect(200)
    ).body.data as Array<{ id: string; isPrimary: boolean }>;

  const createCash = async () => {
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...auth(owner))
      .send({
        name: `E2E Primary Wallet ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'CASH',
      })
      .expect(201);
    createdAccountIds.push(res.body.data.id as string);
    createdLedgerIds.push(res.body.data.ledgerAccountId as string);
    return res.body.data as { id: string; isPrimary: boolean };
  };

  const setPrimary = (id: string, user: AuthedUser = owner) =>
    request(server())
      .patch(api(`/finance/accounts/${id}/primary`))
      .set(...auth(user));

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    originalPrimaryId = (await listAccounts()).find((a) => a.isPrimary)?.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerIds } } })
      .catch(() => undefined);
    if (originalPrimaryId) {
      await setPrimary(originalPrimaryId).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('a new account on a farm that already has accounts is NOT auto-primary; making it primary moves the flag (one at a time)', async () => {
    const a = await createCash();
    const b = await createCash();
    // The demo farm already has live accounts, so neither new one takes the slot on creation.
    expect(a.isPrimary).toBe(false);
    expect(b.isPrimary).toBe(false);

    await setPrimary(a.id).expect(200);
    let primaries = (await listAccounts()).filter((x) => x.isPrimary);
    expect(primaries.map((x) => x.id)).toEqual([a.id]);

    await setPrimary(b.id).expect(200);
    primaries = (await listAccounts()).filter((x) => x.isPrimary);
    expect(primaries.map((x) => x.id)).toEqual([b.id]);
  });

  it('archiving the primary clears its flag, and an archived account cannot be made primary', async () => {
    const acct = await createCash();
    await setPrimary(acct.id).expect(200);

    await request(server())
      .patch(api(`/finance/accounts/${acct.id}/archive`))
      .set(...auth(owner))
      .expect(200);

    const row = await prisma.financialAccount.findUniqueOrThrow({
      where: { id: acct.id },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.isPrimary).toBe(false);

    await setPrimary(acct.id).expect(400);
  });

  it('RBAC: a Worker cannot change the primary wallet', async () => {
    const acct = await createCash();
    await setPrimary(acct.id, worker).expect(403);
  });

  it('an unknown / other-farm account id is a 404', async () => {
    await setPrimary('nonexistent-account-id').expect(404);
  });
});
