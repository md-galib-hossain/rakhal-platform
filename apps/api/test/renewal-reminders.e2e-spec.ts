import { createTestApp, TestContext } from './utils/e2e';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { RenewalReminderService } from '../src/modules/renewal/application/services/renewal-reminder.service';

/**
 * RAKHAL-240 — renewal reminders + win-back (PRD §36.5). Drives
 * `runRenewalSweep` directly (like the scheduler tests). Proves: pre-expiry
 * reminder at T-7 (RNW-01, in-app + email, idempotent on re-run RNW-04), post-
 * expiry win-back at T+7 (RNW-03), win-back **opt-out respected** (recorded, no
 * mail), and a **manual renewal clears the campaign** (RNW-02 — a farm whose
 * latest subscription is ACTIVE is never win-back'd). No auto-charge anywhere.
 */
const DAY = 24 * 60 * 60 * 1000;

describe('Renewal reminders + win-back (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let renewals: RenewalReminderService;
  let planId: string;
  let ownerRoleId: string;
  const tempFarmIds: string[] = [];
  const tempUserIds: string[] = [];

  const makeFarm = async (label: string) => {
    const user = await prisma.user.create({
      data: {
        email: `renew-${label}-${Date.now()}@e2e.test`,
        name: `Renew ${label}`,
        isEmailVerified: true,
      },
      select: { id: true, email: true },
    });
    tempUserIds.push(user.id);
    const farm = await prisma.farm.create({
      data: {
        name: `Renew ${label}`,
        slug: `renew-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: user.id,
      },
      select: { id: true },
    });
    tempFarmIds.push(farm.id);
    await prisma.farmMember.create({
      data: { farmId: farm.id, userId: user.id, roleId: ownerRoleId },
    });
    return { farmId: farm.id, userId: user.id, email: user.email };
  };

  const makeSub = (
    farmId: string,
    status: SubscriptionStatus,
    expiresOffsetDays: number,
  ) =>
    prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: planId,
        status,
        startsAt: new Date(Date.now() - 200 * DAY),
        expiresAt: new Date(Date.now() + expiresOffsetDays * DAY),
      },
      select: { id: true },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    renewals = ctx.app.get(RenewalReminderService);

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'Starter' },
      select: { id: true },
    });
    const ownerRole = await prisma.role.findFirst({
      where: { name: 'Owner', farmId: null, isSystemRole: true },
      select: { id: true },
    });
    if (!plan || !ownerRole) throw new Error('seed missing — run `pnpm seed`');
    planId = plan.id;
    ownerRoleId = ownerRole.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.renewalReminder.deleteMany({
      where: { farmId: { in: tempFarmIds } },
    });
    await prisma.emailLog.deleteMany({
      where: { farmId: { in: tempFarmIds } },
    });
    await prisma.notification.deleteMany({
      where: { farmId: { in: tempFarmIds } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: tempUserIds } },
    });
    for (const fid of tempFarmIds) {
      await prisma.farmSubscription.deleteMany({ where: { farmId: fid } });
      await prisma.farmMember.deleteMany({ where: { farmId: fid } });
      await prisma.farm.delete({ where: { id: fid } }).catch(() => undefined);
    }
    for (const uid of tempUserIds) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('pre-expiry T-7 reminder — in-app + email, idempotent (RNW-01/04)', async () => {
    const farm = await makeFarm('pre7');
    const sub = await makeSub(farm.farmId, SubscriptionStatus.ACTIVE, 7);

    await renewals.runRenewalSweep();

    const reminder = await prisma.renewalReminder.findUnique({
      where: {
        subscriptionId_stage: { subscriptionId: sub.id, stage: 'T_MINUS_7' },
      },
    });
    expect(reminder).not.toBeNull();
    expect(reminder?.channels.sort()).toEqual(['email', 'in_app']);

    const email = await prisma.emailLog.findFirst({
      where: {
        idempotencyKey: `subscription_renewal_reminder:${sub.id}:T_MINUS_7`,
      },
    });
    expect(email?.template).toBe('SUBSCRIPTION_RENEWAL');
    const notif = await prisma.notification.findFirst({
      where: { farmId: farm.farmId, eventKey: 'subscription_renewal_reminder' },
    });
    expect(notif).not.toBeNull();

    // Re-run → no duplicate reminder / email.
    await renewals.runRenewalSweep();
    expect(
      await prisma.renewalReminder.count({
        where: { subscriptionId: sub.id, stage: 'T_MINUS_7' },
      }),
    ).toBe(1);
    expect(
      await prisma.emailLog.count({
        where: {
          idempotencyKey: `subscription_renewal_reminder:${sub.id}:T_MINUS_7`,
        },
      }),
    ).toBe(1);
  });

  it('post-expiry T+7 win-back nudge (RNW-03)', async () => {
    const farm = await makeFarm('win7');
    const sub = await makeSub(farm.farmId, SubscriptionStatus.EXPIRED, -7);

    await renewals.runRenewalSweep();

    const reminder = await prisma.renewalReminder.findUnique({
      where: {
        subscriptionId_stage: { subscriptionId: sub.id, stage: 'WINBACK_7' },
      },
    });
    expect(reminder).not.toBeNull();
    const email = await prisma.emailLog.findFirst({
      where: { idempotencyKey: `subscription_winback:${sub.id}:WINBACK_7` },
    });
    expect(email?.template).toBe('SUBSCRIPTION_RENEWAL');
  });

  it('win-back respects opt-out — recorded but not mailed', async () => {
    const farm = await makeFarm('optout');
    const sub = await makeSub(farm.farmId, SubscriptionStatus.EXPIRED, -3);
    await prisma.notificationPreference.create({
      data: {
        farmId: farm.farmId,
        userId: farm.userId,
        eventKey: 'subscription_winback',
        enabled: false,
        inApp: true,
        push: false,
        sms: false,
        whatsapp: false,
        telegram: false,
        email: false,
      },
    });

    await renewals.runRenewalSweep();

    const reminder = await prisma.renewalReminder.findUnique({
      where: {
        subscriptionId_stage: { subscriptionId: sub.id, stage: 'WINBACK_3' },
      },
    });
    expect(reminder).not.toBeNull();
    expect(reminder?.channels).toEqual([]); // due, but suppressed by opt-out
    expect(
      await prisma.emailLog.count({
        where: { idempotencyKey: `subscription_winback:${sub.id}:WINBACK_3` },
      }),
    ).toBe(0);
  });

  it("a renewed farm is not win-back'd — manual renewal clears the campaign (RNW-02)", async () => {
    const farm = await makeFarm('renewed');
    const oldSub = await makeSub(farm.farmId, SubscriptionStatus.EXPIRED, -7);
    // A fresh manual renewal — the latest subscription is now ACTIVE, far out.
    const newSub = await makeSub(farm.farmId, SubscriptionStatus.ACTIVE, 300);

    await renewals.runRenewalSweep();

    // Neither the old EXPIRED nor the new ACTIVE (not on a cadence day) fires.
    expect(
      await prisma.renewalReminder.count({
        where: { subscriptionId: { in: [oldSub.id, newSub.id] } },
      }),
    ).toBe(0);
  });
});
