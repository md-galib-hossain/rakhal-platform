import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
  ThrowawayOwner,
} from './utils/e2e';

/**
 * WP5b: password login by email OR username. Uses throwaway owners so the
 * shared demo accounts are never given a username.
 */
describe('Auth username login (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let a: ThrowawayOwner;
  let b: ThrowawayOwner;
  let aEmail: string;
  const password = 'ThrowawayOwner123';
  const suffix = Math.random().toString(36).slice(2, 8);
  const nameA = `e2e.user-${suffix}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    a = await createThrowawayOwner(ctx, prisma, 'Username A');
    b = await createThrowawayOwner(ctx, prisma, 'Username B');
    aEmail = (
      await prisma.user.findUniqueOrThrow({
        where: { id: a.userId },
        select: { email: true },
      })
    ).email;
  }, 60_000);

  afterAll(async () => {
    await deleteThrowawayOwner(prisma, a);
    await deleteThrowawayOwner(prisma, b);
    await ctx.app.close();
  });

  const login = (body: Record<string, unknown>) =>
    request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/auth/login`)
      .send(body);

  it('sets a username, normalised to lowercase, and exposes it on /auth/me', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/username`)
      .set(...bearer(a.owner))
      .send({ username: `  ${nameA.toUpperCase()} ` })
      .expect(200);
    expect((res.body as { data: { username: string } }).data.username).toBe(
      nameA,
    );

    const me = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/me`)
      .set(...bearer(a.owner))
      .expect(200);
    expect((me.body as { data: { username: string } }).data.username).toBe(
      nameA,
    );
  });

  it('logs in by username (any case) and by identifier=email, and the legacy email field still works', async () => {
    const byUsername = await login({
      identifier: nameA.toUpperCase(),
      password,
      farmId: a.farmId,
    }).expect(201);
    expect(
      (byUsername.body as { data: { accessToken?: string } }).data.accessToken,
    ).toEqual(expect.any(String));

    await login({ identifier: aEmail, password, farmId: a.farmId }).expect(201);
    await login({ email: aEmail, password, farmId: a.farmId }).expect(201);
  });

  it('wrong password and unknown username return the same 401 body', async () => {
    const wrong = await login({ identifier: nameA, password: 'WrongPass123' });
    const unknown = await login({
      identifier: `nobody-${suffix}`,
      password: 'WrongPass123',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    // Bodies carry per-request ids/timestamps; the client-visible error must be identical.
    const pick = (b: unknown) => {
      const e = b as { code?: string; message?: string };
      return { code: e.code, message: e.message };
    };
    expect(pick(wrong.body)).toEqual(pick(unknown.body));
  });

  it('requires an email or an identifier', async () => {
    await login({ password }).expect(400);
  });

  it('rejects invalid and reserved usernames with 400', async () => {
    for (const username of ['ab', 'has space', 'a@b.com', 'admin']) {
      await request(ctx.app.getHttpServer())
        .patch(`${ctx.prefix}/auth/me/username`)
        .set(...bearer(a.owner))
        .send({ username })
        .expect(400);
    }
  });

  it('is 409 when another user holds the name, case-insensitively', async () => {
    await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/username`)
      .set(...bearer(b.owner))
      .send({ username: nameA.toUpperCase() })
      .expect(409);
  });

  it('requires authentication to set a username', async () => {
    await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/username`)
      .send({ username: `anon-${suffix}` })
      .expect(401);
  });

  it('repeated wrong passwords by username lock the account like email login', async () => {
    const lockName = `lock-${suffix}`;
    await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/username`)
      .set(...bearer(b.owner))
      .send({ username: lockName })
      .expect(200);

    // Default policy is 5 failures; stop early once the throttler or lockout answers.
    for (let i = 0; i < 6; i += 1) {
      await login({ identifier: lockName, password: 'WrongPass123' });
    }
    const correct = await login({ identifier: lockName, password });
    expect([401, 429]).toContain(correct.status);
  });
});
