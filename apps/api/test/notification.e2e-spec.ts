import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { NotificationService } from '../src/modules/notification/application/services/notification.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Notification engine (§20 / API §17) e2e. Drives the internal `notifyUsers`
 * emit API (the path other modules will use) via the app context, then exercises
 * the HTTP bell feed (list / unread / mark-read / read-all), preferences (incl.
 * the mandatory-event guard + quiet-hours SMS suppression), and RBAC.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let service: NotificationService;
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
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
    service = ctx.app.get(NotificationService);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
    await resetOwnerState();
  }, 30_000);

  afterAll(async () => {
    await resetOwnerState();
    await ctx.app.close();
  });

  async function resetOwnerState() {
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
    await prisma.notificationPreference.deleteMany({
      where: { userId: ownerUserId },
    });
    await prisma.notificationSetting.deleteMany({
      where: { userId: ownerUserId },
    });
    await prisma.deviceToken.deleteMany({ where: { userId: ownerUserId } });
  }

  const emit = (eventKey: string) =>
    service.notifyUsers({
      farmId: owner.farmId,
      userIds: [ownerUserId],
      eventKey,
      title: `T:${eventKey}`,
      message: `M:${eventKey}`,
      link: '/x',
    });

  it('notifyUsers routes in-app + push + SMS (no quiet hours)', async () => {
    const created = await emit('animal_sickness_reported');
    expect(created).toHaveLength(1);
    expect(created[0].channelsSent).toEqual(
      expect.arrayContaining(['in_app', 'push', 'sms']),
    );
  });

  it('lists notifications with an unread count', async () => {
    const res = await request(server())
      .get(api('/notifications'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data.unread_count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.notifications[0]).toMatchObject({
      type: 'health_safety',
      priority: 'critical',
      read: false,
    });
  });

  it('marks one read, then all read → unread_count 0', async () => {
    const list = await request(server())
      .get(api('/notifications?status=unread'))
      .set(...auth(owner))
      .expect(200);
    const firstId = list.body.data.notifications[0].id as string;

    await request(server())
      .post(api(`/notifications/${firstId}/read`))
      .set(...auth(owner))
      .expect(201);

    await emit('low_feed_stock'); // add another unread
    await request(server())
      .post(api('/notifications/read-all'))
      .set(...auth(owner))
      .expect(201);

    const after = await request(server())
      .get(api('/notifications'))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.unread_count).toBe(0);
  });

  it('404s marking an unknown notification', async () => {
    await request(server())
      .post(api('/notifications/does-not-exist/read'))
      .set(...auth(owner))
      .expect(404);
  });

  it('exposes the full preference catalogue with the mandatory flag', async () => {
    const res = await request(server())
      .get(api('/notifications/preferences'))
      .set(...auth(owner))
      .expect(200);
    const prefs = res.body.data.preferences as Array<{
      event_key: string;
      can_disable: boolean;
    }>;
    expect(prefs.length).toBeGreaterThan(15);
    expect(
      prefs.find((p) => p.event_key === 'animal_sickness_reported')
        ?.can_disable,
    ).toBe(false);
  });

  it('updates preferences + quiet hours, and a disabled event stops emitting', async () => {
    await request(server())
      .patch(api('/notifications/preferences'))
      .set(...auth(owner))
      .send({
        quiet_hours: { start: '00:00', end: '23:59' },
        preferences: [{ event_key: 'todays_tasks_ready', enabled: false }],
      })
      .expect(200);

    // Disabled disablable event → no notification created.
    expect(await emit('todays_tasks_ready')).toHaveLength(0);

    // Quiet hours (covering now) suppress SMS but keep in-app.
    const created = await emit('animal_sickness_reported');
    expect(created[0].channelsSent).toEqual(['in_app']);
  });

  it('rejects disabling a mandatory health & safety event (400)', async () => {
    await request(server())
      .patch(api('/notifications/preferences'))
      .set(...auth(owner))
      .send({
        preferences: [{ event_key: 'medicine_expired', enabled: false }],
      })
      .expect(400);
  });

  it('400s an unknown event key in preferences', async () => {
    await request(server())
      .patch(api('/notifications/preferences'))
      .set(...auth(owner))
      .send({ preferences: [{ event_key: 'nope', enabled: false }] })
      .expect(400);
  });

  describe('push device tokens', () => {
    const token = `e2e-fcm-token-${Date.now()}`;

    it('registers, lists, then unregisters a device token', async () => {
      const reg = await request(server())
        .post(api('/notifications/devices'))
        .set(...auth(owner))
        .send({ token, platform: 'android' })
        .expect(201);
      expect(reg.body.data.registered).toBe(true);

      const list = await request(server())
        .get(api('/notifications/devices'))
        .set(...auth(owner))
        .expect(200);
      expect(
        (list.body.data as Array<{ platform: string }>).some(
          (d) => d.platform === 'android',
        ),
      ).toBe(true);

      const del = await request(server())
        .delete(api('/notifications/devices'))
        .set(...auth(owner))
        .send({ token, platform: 'android' })
        .expect(200);
      expect(del.body.data.removed).toBe(true);
    });

    it('exposes push in the preference catalogue channels', async () => {
      const res = await request(server())
        .get(api('/notifications/preferences'))
        .set(...auth(owner))
        .expect(200);
      const first = res.body.data.preferences[0] as {
        channels: Record<string, boolean>;
      };
      expect(first.channels).toHaveProperty('push');
      expect(first.channels).toHaveProperty('telegram');
    });
  });

  describe('RBAC', () => {
    it('worker may read their own bell feed', async () => {
      await request(server())
        .get(api('/notifications'))
        .set(...auth(worker))
        .expect(200);
    });

    it('worker may NOT change preferences (no notification.update)', async () => {
      await request(server())
        .patch(api('/notifications/preferences'))
        .set(...auth(worker))
        .send({ quiet_hours: { start: '22:00', end: '05:00' } })
        .expect(403);
    });

    it('manager may change preferences', async () => {
      await request(server())
        .patch(api('/notifications/preferences'))
        .set(...auth(manager))
        .send({ quiet_hours: { start: '23:00', end: '06:00' } })
        .expect(200);
      // clean up the manager's setting
      const mgr = await prisma.user.findUniqueOrThrow({
        where: { email: 'manager@demo.rakhal.test' },
        select: { id: true },
      });
      await prisma.notificationSetting.deleteMany({
        where: { userId: mgr.id },
      });
    });

    it('rejects an unauthenticated request', async () => {
      await request(server()).get(api('/notifications')).expect(401);
    });
  });
});
