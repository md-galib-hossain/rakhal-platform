import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { CacheService } from '../src/core/cache/cache.service';
import { TelegramLinkService } from '../src/modules/notification/application/services/telegram-link.service';
import { TelegramBotProvider } from '../src/modules/notification/application/channels/telegram-bot.provider';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Telegram notification channel & commands (RAKHAL-257) e2e.
 * Tests account linking, command routing (/start, /status, /help, /unlink, V2 fallback),
 * self-service status & unlink endpoints, and the provider fallback when unconfigured.
 */
describe('Notifications — Telegram (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let cache: CacheService;
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
    cache = ctx.app.get(CacheService);
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

  it('GET /notifications/telegram/connect-session returns 6-digit code and deepLink', async () => {
    const res = await request(server())
      .get(api('/notifications/telegram/connect-session'))
      .set(...auth(owner))
      .expect(200);

    expect(res.body.data).toMatchObject({
      configured: expect.any(Boolean),
      botUsername: expect.any(String),
      expiresIn: 900,
    });
    expect(res.body.data.code).toMatch(/^\d{6}$/);
    expect(typeof res.body.data.deepLink).toBe('string');
    expect(typeof res.body.data.qrPayload).toBe('string');
  });

  it('rejects an unauthenticated connect-session request', async () => {
    await request(server())
      .get(api('/notifications/telegram/connect-session'))
      .expect(401);
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
    // botUsername is unset in test env, so sign the exact required payload directly
    const token = await jwt.signAsync({
      purpose: 'telegram_link',
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

  it('GET /notifications/telegram/status returns linked status', async () => {
    const res = await request(server())
      .get(api('/notifications/telegram/status'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toMatchObject({
      linked: true,
      count: 1,
    });
    expect(res.body.data.chats).toHaveLength(1);
  });

  it('handles /status command when linked', async () => {
    await expect(
      telegramLink.handleUpdate({
        message: { chat: { id: 424242 }, text: '/status' },
      }),
    ).resolves.not.toThrow();
  });

  it('handles /help command gracefully', async () => {
    await expect(
      telegramLink.handleUpdate({
        message: { chat: { id: 424242 }, text: '/help' },
      }),
    ).resolves.not.toThrow();
  });

  it('handles /start without a token (welcome guide)', async () => {
    await expect(
      telegramLink.handleUpdate({
        message: { chat: { id: 888888 }, text: '/start' },
      }),
    ).resolves.not.toThrow();

    // No row should be created for /start without token
    const row = await prisma.deviceToken.findFirst({
      where: { token: '888888' },
    });
    expect(row).toBeNull();
  });

  it('handles conversational farm query fallback (V2 AI seam)', async () => {
    await expect(
      telegramLink.handleUpdate({
        message: {
          chat: { id: 424242 },
          text: 'What is today milk collection?',
        },
      }),
    ).resolves.not.toThrow();
  });

  it('unlinks chat id via /unlink command', async () => {
    await telegramLink.handleUpdate({
      message: { chat: { id: 424242 }, text: '/unlink' },
    });

    const row = await prisma.deviceToken.findFirst({
      where: { token: '424242' },
    });
    expect(row).toBeNull();
  });

  it('handles /status command when not linked', async () => {
    await expect(
      telegramLink.handleUpdate({
        message: { chat: { id: 424242 }, text: '/status' },
      }),
    ).resolves.not.toThrow();
  });

  it('DELETE /notifications/telegram/link unlinks via authenticated web API', async () => {
    // Re-link first
    const token = await jwt.signAsync({
      purpose: 'telegram_link',
      userId: ownerUserId,
      farmId: owner.farmId,
    });
    await telegramLink.handleUpdate({
      message: { chat: { id: 777777 }, text: `/start ${token}` },
    });

    const res = await request(server())
      .delete(api('/notifications/telegram/link'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toMatchObject({ unlinked: true });

    const check = await prisma.deviceToken.findFirst({
      where: { token: '777777' },
    });
    expect(check).toBeNull();
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

  it('links a chat id on /start <code> with a valid 6-digit session code', async () => {
    const replySpy = jest.spyOn(telegramLink, 'reply');
    const session = await telegramLink.mintConnectSession(
      ownerUserId,
      owner.farmId,
    );

    await telegramLink.handleUpdate({
      message: { chat: { id: 112233 }, text: `/start ${session.code}` },
    });

    const row = await prisma.deviceToken.findFirst({
      where: { userId: ownerUserId, token: '112233', provider: 'telegram' },
    });
    expect(row).toMatchObject({
      token: '112233',
      platform: 'telegram',
      provider: 'telegram',
    });

    // Code is single-use: deleted from cache
    const cached = await cache.get(`telegram:link_code:${session.code}`);
    expect(cached).toBeUndefined();

    // Bengali confirmation reply sent
    expect(replySpy).toHaveBeenCalledWith(
      112233,
      expect.stringContaining(
        'সফলভাবে রাখাল (Rakhal) অ্যাকাউন্টের সাথে যুক্ত হয়েছে',
      ),
    );

    await prisma.deviceToken.deleteMany({ where: { token: '112233' } });
  });

  it('links a chat id on bare 6-digit code message', async () => {
    const replySpy = jest.spyOn(telegramLink, 'reply');
    const session = await telegramLink.mintConnectSession(
      ownerUserId,
      owner.farmId,
    );

    await telegramLink.handleUpdate({
      message: { chat: { id: 223344 }, text: session.code },
    });

    const row = await prisma.deviceToken.findFirst({
      where: { userId: ownerUserId, token: '223344', provider: 'telegram' },
    });
    expect(row).toMatchObject({
      token: '223344',
      platform: 'telegram',
      provider: 'telegram',
    });

    // Code is single-use: deleted from cache
    const cached = await cache.get(`telegram:link_code:${session.code}`);
    expect(cached).toBeUndefined();

    expect(replySpy).toHaveBeenCalledWith(
      223344,
      expect.stringContaining(
        'সফলভাবে রাখাল (Rakhal) অ্যাকাউন্টের সাথে যুক্ত হয়েছে',
      ),
    );

    await prisma.deviceToken.deleteMany({ where: { token: '223344' } });
  });

  it('rejects an invalid or expired 6-digit code with error message', async () => {
    const replySpy = jest.spyOn(telegramLink, 'reply');

    await telegramLink.handleUpdate({
      message: { chat: { id: 334455 }, text: '999999' },
    });

    const row = await prisma.deviceToken.findFirst({
      where: { token: '334455' },
    });
    expect(row).toBeNull();

    expect(replySpy).toHaveBeenCalledWith(
      334455,
      expect.stringContaining('এই কোডটি সঠিক নয় অথবা এর মেয়াদ শেষ হয়ে গেছে'),
    );
  });

  it('provider defers when TELEGRAM_BOT_TOKEN is unset', async () => {
    const originalToken = (telegramProvider as any).config.botToken;
    (telegramProvider as any).config.botToken = undefined;
    try {
      const result = await telegramProvider.send({
        userId: ownerUserId,
        eventKey: 'low_feed_stock',
        category: 'inventory',
        priority: 'medium',
        title: 'Feed Low',
        message: 'Silage stock is under 3 days.',
      });
      expect(telegramProvider.isConfigured()).toBe(false);
      expect(result).toEqual({ delivered: false, detail: 'not_configured' });
    } finally {
      (telegramProvider as any).config.botToken = originalToken;
    }
  });

  it('worker may also mint their own link-token (self-service, no elevated perm)', async () => {
    await request(server())
      .get(api('/notifications/telegram/link-token'))
      .set(...auth(worker))
      .expect(200);
  });
});
