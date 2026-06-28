import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Onboarding e2e (RAKHAL-022/023/025): status/complete flag, configure (reuses
 * Settings), and the accept-invite loop (token → membership) that closes the
 * RAKHAL-030 gap. Requires the dev stack + `pnpm seed`.
 */
describe('Onboarding (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const uniquePhone = (): string => `017${String(Date.now()).slice(-8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('status + complete', () => {
    it('owner reads onboarding status with step hints', async () => {
      const res = await request(server())
        .get(api('/onboarding/status'))
        .set(...auth(owner))
        .expect(200);
      expect(typeof res.body.data.has_completed_onboarding).toBe('boolean');
      expect(res.body.data.steps.farm.done).toBe(true);
    });

    it('complete sets the flag (then restores for idempotency)', async () => {
      const original = (
        await request(server())
          .get(api('/onboarding/status'))
          .set(...auth(owner))
      ).body.data.has_completed_onboarding as boolean;
      try {
        const res = await request(server())
          .post(api('/onboarding/complete'))
          .set(...auth(owner))
          .expect(201);
        expect(res.body.data.has_completed_onboarding).toBe(true);
      } finally {
        await prisma.farm.update({
          where: { id: owner.farmId },
          data: { hasCompletedOnboarding: original },
        });
      }
    });

    it('worker cannot complete onboarding (FORBIDDEN)', async () => {
      await request(server())
        .post(api('/onboarding/complete'))
        .set(...auth(worker))
        .expect(403);
    });
  });

  describe('configure', () => {
    it('owner configures milk sessions (capture + restore)', async () => {
      const original = (
        await request(server())
          .get(api('/settings/modules'))
          .set(...auth(owner))
      ).body.data.milk.active_sessions as string[];
      try {
        const res = await request(server())
          .post(api('/onboarding/configure'))
          .set(...auth(owner))
          .send({ active_sessions: ['morning', 'noon', 'evening'] })
          .expect(201);
        expect(res.body.data.sessions_configured).toEqual([
          'morning',
          'noon',
          'evening',
        ]);
      } finally {
        await request(server())
          .patch(api('/settings/modules'))
          .set(...auth(owner))
          .send({ milk: { active_sessions: original } });
      }
    });
  });

  describe('accept-invite', () => {
    it('401 without auth, 400 on a too-short token', async () => {
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .send({ token: 'whatever-token' })
        .expect(401);

      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(owner))
        .send({ token: 'short' })
        .expect(400);
    });

    it('404 on an unknown token', async () => {
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(owner))
        .send({ token: 'definitely-not-a-real-invite-token' })
        .expect(404);
    });

    it('409 when the accepting user is already a member', async () => {
      const phone = uniquePhone();
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(owner))
        .send({ phone, role: 'Worker' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { phone, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(owner))
        .send({ token: invite!.token })
        .expect(409);
    });

    it('a fresh user redeems an invite and joins the farm', async () => {
      const email = `invitee_${Date.now()}@demo.rakhal.test`;
      const password = 'Str0ng!Pass123';
      await request(server())
        .post(api('/auth/register'))
        .send({ email, name: 'Invited User', password })
        .expect(201);
      const freshToken = (
        await request(server())
          .post(api('/auth/login'))
          .send({ email, password, farmId: 'bootstrap' })
      ).body.data.accessToken as string;

      const phone = uniquePhone();
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(owner))
        .send({ phone, role: 'Worker', name: 'Invited User' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { phone, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });

      const accepted = await request(server())
        .post(api('/onboarding/accept-invite'))
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ token: invite!.token })
        .expect(201);
      expect(accepted.body.data.farm_id).toBe(owner.farmId);
      expect(accepted.body.data.role).toBe('worker');

      // The invitee can now see the farm they joined.
      const farms = await request(server())
        .get(api('/farms'))
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);
      expect(
        (farms.body.data as Array<{ id: string }>).some(
          (f) => f.id === owner.farmId,
        ),
      ).toBe(true);
    });
  });
});
