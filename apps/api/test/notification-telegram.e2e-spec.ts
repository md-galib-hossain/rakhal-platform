import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { TelegramLinkService } from '../src/modules/notification/application/services/telegram-link.service';
import { TelegramBotProvider } from '../src/modules/notification/application/channels/telegram-bot.provider';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Telegram notification channel (RAKHAL-257) e2e. `TELEGRAM_BOT_TOKEN` is
 * unset in the test env (like every other real-world integration secret in
 * this suite), so it exercises the "not configured, defer gracefully" path
 * end-to-end plus the linking business logic directly via the service (the
 * same pattern `notification.e2e-spec.ts` uses for `notifyUsers`).
 */
describe('Notifications — Telegram (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let jwt: JwtService;
  let telegramLink: TelegramLinkService;
  let telegramProvider: TelegramBotProvider;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
    jwt = ctx.app.get(JwtService);
    telegramLink = ctx.app.get(TelegramLinkService);
    telegramProvider = ctx.app.get(TelegramBotProvider);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
    await prisma.deviceToken.deleteMany({
      where: { userId: ownerUserId, provider: 'telegram' },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.deviceToken.deleteMany({
      where: { userId: ownerUserId, provider: 'telegram' },
    });
    await ctx.app.close();
  });

  it('GET /notifications/telegram/link-token returns a configured flag', async () => {
    const res = await request(server())
      .get(api('/notifications/telegram/link-token'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toHaveProperty('configured');
    expect(res.body.data).toHaveProperty('deepLink');
  });

  it('rejects an unauthenticated link-token request', async () => {
    await request(server())
      .get(api('/notifications/telegram/link-token'))
      .expect(401);
  });

  it('webhook always 200s Telegram, even on a bad secret, and does nothing', async () => {
    await request(server())
      .post(api('/notifications/telegram/webhook'))
      .set('X-Telegram-Bot-Api-Secret-Token', 'wrong-secret')
      .send({ message: { chat: { id: 999 }, text: '/start bogus' } })
      .expect(200);

    const rows = await prisma.deviceToken.findMany({
      where: { userId: ownerUserId, provider: 'telegram' },
    });
    expect(rows).toHaveLength(0);
  });

  it('links a chat id on a valid /start token (service-level)', async () => {
    await telegramLink.mintLinkToken(ownerUserId, owner.farmId);
    // botUsername is unset in test env, so the deep link has no token to
    // parse out — sign the same payload shape directly for the test.
    const token = await jwt.signAsync({
      userId: ownerUserId,
      farmId: owner.farmId,
    });

    await telegramLink.handleUpdate({
      message: { chat: { id: 424242 }, text: `/start ${token}` },
    });

    const row = await prisma.deviceToken.findFirst({
      where: { userId: ownerUserId, provider: 'telegram' },
    });
    expect(row).toMatchObject({
      token: '424242',
      platform: 'telegram',
      provider: 'telegram',
    });
  });

  it('ignores an expired/garbage /start token — no row created', async () => {
    await telegramLink.handleUpdate({
      message: { chat: { id: 555555 }, text: '/start not-a-real-jwt' },
    });
    const row = await prisma.deviceToken.findFirst({
      where: { token: '555555' },
    });
    expect(row).toBeNull();
  });

  it('provider defers when TELEGRAM_BOT_TOKEN is unset', async () => {
    const result = await telegramProvider.send({
      userId: ownerUserId,
      eventKey: 'low_feed_stock',
      category: 'inventory',
      priority: 'medium',
      title: 'T',
      message: 'M',
    });
    expect(telegramProvider.isConfigured()).toBe(false);
    expect(result).toEqual({ delivered: false, detail: 'not_configured' });
  });

  it('worker may also mint their own link-token (self-service, no elevated perm)', async () => {
    await request(server())
      .get(api('/notifications/telegram/link-token'))
      .set(...auth(worker))
      .expect(200);
  });
});
