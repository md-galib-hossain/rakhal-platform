import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * ServiceProvider directory (settings module) — technician/vet contacts used
 * by Reproduction's TECHNICIAN_SUPPLIED semen source (no ticket #, 2026-08-15).
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Settings — Service Providers (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

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
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates, lists, updates, and soft-deletes a service provider', async () => {
    const created = await request(server())
      .post(api('/settings/service-providers'))
      .set(...auth(owner))
      .send({
        name: `E2E Tech ${Date.now()}`,
        phone: '01700000000',
        type: 'AI_TECHNICIAN',
      })
      .expect(201);
    expect(created.body.data.type).toBe('AI_TECHNICIAN');
    expect(created.body.data.is_active).toBe(true);
    const id = created.body.data.id;

    const listed = await request(server())
      .get(api('/settings/service-providers'))
      .set(...auth(owner))
      .expect(200);
    expect(
      listed.body.data.service_providers.some(
        (p: { id: string }) => p.id === id,
      ),
    ).toBe(true);

    const updated = await request(server())
      .patch(api(`/settings/service-providers/${id}`))
      .set(...auth(owner))
      .send({ phone: '01800000000' })
      .expect(200);
    expect(updated.body.data.phone).toBe('01800000000');

    await request(server())
      .delete(api(`/settings/service-providers/${id}`))
      .set(...auth(owner))
      .expect(200);

    const listedAfterDelete = await request(server())
      .get(api('/settings/service-providers'))
      .set(...auth(owner))
      .expect(200);
    expect(
      listedAfterDelete.body.data.service_providers.some(
        (p: { id: string }) => p.id === id,
      ),
    ).toBe(false);
  });

  it('403s a Worker attempting to create a service provider (settings.update, manager+ only)', async () => {
    await request(server())
      .post(api('/settings/service-providers'))
      .set(...auth(worker))
      .send({ name: `E2E Worker Tech ${Date.now()}`, type: 'AI_TECHNICIAN' })
      .expect(403);
  });

  it("cross-farm isolation: a second farm cannot see or edit the first farm's service providers", async () => {
    const created = await request(server())
      .post(api('/settings/service-providers'))
      .set(...auth(owner))
      .send({ name: `E2E Isolation Tech ${Date.now()}`, type: 'VETERINARIAN' })
      .expect(201);
    const id = created.body.data.id;

    const farm2 = await ctx.app
      .get(FarmService)
      .create(ownerUserId, { name: `E2E SP Cross Farm ${Date.now()}` });
    const farm2Login = await request(server())
      .post(api('/auth/login'))
      .send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId: farm2.id,
      })
      .expect(201);
    const farm2Token = farm2Login.body.data.accessToken as string;

    const listedOnFarm2 = await request(server())
      .get(api('/settings/service-providers'))
      .set('Authorization', `Bearer ${farm2Token}`)
      .expect(200);
    expect(
      listedOnFarm2.body.data.service_providers.some(
        (p: { id: string }) => p.id === id,
      ),
    ).toBe(false);

    await request(server())
      .patch(api(`/settings/service-providers/${id}`))
      .set('Authorization', `Bearer ${farm2Token}`)
      .send({ phone: '01900000000' })
      .expect(404);
  });
});
