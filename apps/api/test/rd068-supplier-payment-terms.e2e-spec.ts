import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { AuthedUser, bearer, createTestApp, TestContext } from './utils/e2e';

/**
 * RD-068 (docs/TECH_DEBT.md) — `Supplier.paymentTermsDays` (drives `Payable.dueDate`
 * derivation, see `rakhal-365-supplier-fk.e2e-spec.ts`) used to have no write path at all and
 * stayed `0` forever regardless of what the free-text `paymentTerms` said. `POST/PATCH
 * /settings/suppliers` now derives `paymentTermsDays` from `paymentTerms` on every write
 * (`parsePaymentTermsDays()`), so the two fields can no longer disagree.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`), same precedent as
 * `rakhal-373-supplier-read.e2e-spec.ts`. Requires the dev stack up + `pnpm seed`.
 */
describe('Settings — Supplier payment-terms derivation (e2e, RD-068)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let owner: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    farmService = ctx.app.get(FarmService);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const farm = await farmService.create(user.id, {
      name: unique('E2E-RD068-SupplierFarm'),
    });
    const login = await request(server())
      .post(api('/auth/login'))
      .send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId: farm.id,
      })
      .expect(201);
    owner = { token: login.body.data.accessToken as string, farmId: farm.id };
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('POST /settings/suppliers derives payment_terms_days from payment_terms', async () => {
    const res = await request(server())
      .post(api('/settings/suppliers'))
      .set(...bearer(owner))
      .send({
        name: unique('E2E-RD068 Net45 Supplier'),
        payment_terms: 'net_45',
      })
      .expect(201);

    expect(res.body.data.payment_terms).toBe('net_45');
    expect(res.body.data.payment_terms_days).toBe(45);

    const row = await prisma.supplier.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
      select: { paymentTermsDays: true },
    });
    expect(row.paymentTermsDays).toBe(45);
  });

  it('a "cod" supplier derives payment_terms_days: 0', async () => {
    const res = await request(server())
      .post(api('/settings/suppliers'))
      .set(...bearer(owner))
      .send({ name: unique('E2E-RD068 COD Supplier'), payment_terms: 'cod' })
      .expect(201);

    expect(res.body.data.payment_terms_days).toBe(0);
  });

  it('PATCH re-derives payment_terms_days when payment_terms changes, keeping the two in sync', async () => {
    const created = await request(server())
      .post(api('/settings/suppliers'))
      .set(...bearer(owner))
      .send({
        name: unique('E2E-RD068 Update Supplier'),
        payment_terms: 'net_7',
      })
      .expect(201);
    expect(created.body.data.payment_terms_days).toBe(7);

    const updated = await request(server())
      .patch(api(`/settings/suppliers/${created.body.data.id as string}`))
      .set(...bearer(owner))
      .send({ payment_terms: 'net_60' })
      .expect(200);

    expect(updated.body.data.payment_terms).toBe('net_60');
    expect(updated.body.data.payment_terms_days).toBe(60);
  });
});
