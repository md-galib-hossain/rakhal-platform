import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * One finance account per farm: no form asks for a wallet. The server resolves the
 * farm's account (primary, else oldest live) and every payment / income that omits
 * `financialAccountId` lands on it.
 */
describe('Finance — one account per farm', () => {
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

  it('GET /finance/accounts/farm-account returns the same live account every time', async () => {
    const a = await request(server())
      .get(api('/finance/accounts/farm-account'))
      .set(...auth(owner));
    expect(a.status).toBe(200);
    const b = await request(server())
      .get(api('/finance/accounts/farm-account'))
      .set(...auth(owner));
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(a.body.data.deletedAt).toBeNull();
  });

  it('POST /finance/payments without financialAccountId posts to the farm account', async () => {
    const farmAccount = await request(server())
      .get(api('/finance/accounts/farm-account'))
      .set(...auth(owner));
    const res = await request(server())
      .post(api('/finance/payments'))
      .set(...auth(owner))
      .send({
        direction: 'INCOMING',
        amount: 10,
        method: 'CASH',
        transactionDate: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    const payment = await prisma.financePayment.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(payment.financialAccountId).toBe(farmAccount.body.data.id);
  });
});
