import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';

/**
 * RAKHAL-107 (backend scope) — Bangla i18n infrastructure. Proves: a user
 * defaults to Bangla, `PATCH /auth/me/language` persists the toggle, an
 * `Accept-Language` header overrides per-request without touching the stored
 * preference, and a translated common error message comes back in Bangla.
 */
describe('i18n — language preference + Accept-Language override (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let worker: AuthedUser;
  let workerUserId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const user = await prisma.user.findUnique({
      where: { email: 'worker@demo.rakhal.test' },
      select: { id: true },
    });
    if (!user) throw new Error('seed missing — run `pnpm seed`');
    workerUserId = user.id;
  }, 30_000);

  afterEach(async () => {
    // Don't leave the shared demo user mutated for other suites.
    await prisma.user.update({
      where: { id: workerUserId },
      data: { preferredLanguage: 'BN' },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('defaults new/seeded users to Bangla', async () => {
    const user = await prisma.user.findUnique({
      where: { id: workerUserId },
      select: { preferredLanguage: true },
    });
    expect(user?.preferredLanguage).toBe('BN');
  });

  it('PATCH /auth/me/language persists the toggle', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/language`)
      .set(...bearer(worker))
      .send({ preferredLanguage: 'en' })
      .expect(200);

    expect(
      (res.body as { data: { preferredLanguage: string } }).data
        .preferredLanguage,
    ).toBe('EN');

    const user = await prisma.user.findUnique({
      where: { id: workerUserId },
      select: { preferredLanguage: true },
    });
    expect(user?.preferredLanguage).toBe('EN');
  });

  it('rejects an unsupported language code', async () => {
    await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/auth/me/language`)
      .set(...bearer(worker))
      .send({ preferredLanguage: 'fr' })
      .expect(400);
  });

  it('translates a common error message to Bangla via Accept-Language', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/sessions`)
      .set('Accept-Language', 'bn')
      .expect(401);

    expect((res.body as { message: string }).message).toBe(
      'অননুমোদিত প্রবেশাধিকার',
    );
  });

  it('defaults to Bangla with no Accept-Language override (Bangla-first)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/sessions`)
      .expect(401);

    expect((res.body as { message: string }).message).toBe(
      'অননুমোদিত প্রবেশাধিকার',
    );
  });

  it('an explicit English Accept-Language overrides the default', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/auth/sessions`)
      .set('Accept-Language', 'en')
      .expect(401);

    expect((res.body as { message: string }).message).toBe('Unauthorized');
  });
});
