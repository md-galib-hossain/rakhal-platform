import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { NotificationService } from '../src/modules/notification/application/services/notification.service';
import { ChannelRouterService } from '../src/modules/notification/application/services/channel-router.service';

/**
 * RAKHAL-256 — dynamic channel routing (`customer-api`, PRD §20.1a). Per-farm
 * overrides pick which channels an event uses; delivery honours the routed set
 * (replacing the built-in default) while a user's own override still wins.
 */
interface RoutingEvent {
  event_key: string;
  channels: { push: boolean; sms: boolean; telegram: boolean };
  farm_override: boolean;
}

const DEDUPE = 'e2e-routing-delivery';

describe('Channel routing (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let notifications: NotificationService;
  let router: ChannelRouterService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const routingOf = (body: unknown, key: string): RoutingEvent | undefined =>
    (body as { data: { events: RoutingEvent[] } }).data.events.find(
      (e) => e.event_key === key,
    );

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    notifications = ctx.app.get(NotificationService);
    router = ctx.app.get(ChannelRouterService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!user) throw new Error('demo owner missing — run `pnpm seed`');
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.notificationRoutingRule.deleteMany({
      where: { farmId: owner.farmId },
    });
    await prisma.notification.deleteMany({ where: { dedupeKey: DEDUPE } });
    await ctx.app.close();
  });

  it('GET /notifications/routing shows built-in defaults (no override)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/notifications/routing`)
      .set(...bearer(owner))
      .expect(200);

    const sickness = routingOf(res.body, 'animal_sickness_reported');
    expect(sickness?.channels.sms).toBe(true); // built-in default
    expect(sickness?.farm_override).toBe(false);
  });

  it('PUT overrides an event channel; DELETE reverts it', async () => {
    const put = await request(ctx.app.getHttpServer())
      .put(`${ctx.prefix}/notifications/routing/low_medicine_stock`)
      .set(...bearer(owner))
      .send({ channels: ['in_app', 'telegram'] })
      .expect(200);
    const overridden = routingOf(put.body, 'low_medicine_stock');
    expect(overridden?.channels.telegram).toBe(true);
    expect(overridden?.channels.push).toBe(false); // routed set replaces default
    expect(overridden?.farm_override).toBe(true);

    const del = await request(ctx.app.getHttpServer())
      .delete(`${ctx.prefix}/notifications/routing/low_medicine_stock`)
      .set(...bearer(owner))
      .expect(200);
    const reverted = routingOf(del.body, 'low_medicine_stock');
    expect(reverted?.farm_override).toBe(false);
    expect(reverted?.channels.push).toBe(true); // back to built-in default
    expect(reverted?.channels.telegram).toBe(false);
  });

  it('delivery honours the routed channels (telegram in, push out)', async () => {
    await router.setFarmRule(owner.farmId, 'low_feed_stock', [
      'in_app',
      'telegram',
    ]);

    const created = await notifications.notifyUsers({
      farmId: owner.farmId,
      userIds: [ownerUserId],
      eventKey: 'low_feed_stock',
      title: 'Feed low',
      message: 'Silage running out',
      dedupeKey: DEDUPE,
    });

    expect(created).toHaveLength(1);
    const sent = created[0].channelsSent;
    expect(sent).toContain('in_app');
    expect(sent).toContain('telegram');
    expect(sent).not.toContain('push'); // default had push; routing dropped it
  });
});
