import { createTestApp, TestContext } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { TransactionalEmailService } from '../src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from '../src/modules/email/domain/enums/email-template.enum';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import { SubscriptionLifecycleService } from '../src/modules/subscription/application/services/subscription-lifecycle.service';

/**
 * RAKHAL-238 — transactional communications (PRD §36.3). Proves the idempotency
 * spine (COM-02: a replayed trigger never double-mails) plus the three wired
 * events: welcome-on-farm-create, and the subscription-expiry mail from the
 * lifecycle sweep. Emails are queued (BullMQ) — we assert on the `EmailLog`
 * ledger rows, not on delivery (no provider creds in test).
 */
describe('Transactional comms (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let txEmail: TransactionalEmailService;
  let farmService: FarmService;
  let legal: LegalConsentService;
  let lifecycle: SubscriptionLifecycleService;

  const tempFarmIds: string[] = [];
  const tempUserIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    txEmail = ctx.app.get(TransactionalEmailService);
    farmService = ctx.app.get(FarmService);
    legal = ctx.app.get(LegalConsentService);
    lifecycle = ctx.app.get(SubscriptionLifecycleService);
  }, 30_000);

  afterAll(async () => {
    await prisma.emailLog.deleteMany({
      where: {
        OR: [
          { farmId: { in: tempFarmIds } },
          { userId: { in: tempUserIds } },
          { idempotencyKey: { startsWith: 'e2e-tx-' } },
        ],
      },
    });
    for (const fid of tempFarmIds) {
      await prisma.farmSubscription.deleteMany({ where: { farmId: fid } });
      await prisma.farmMember.deleteMany({ where: { farmId: fid } });
      await prisma.farm.delete({ where: { id: fid } }).catch(() => undefined);
    }
    await prisma.trialGrant.deleteMany({
      where: { userId: { in: tempUserIds } },
    });
    await prisma.consentRecord.deleteMany({
      where: { userId: { in: tempUserIds } },
    });
    for (const uid of tempUserIds) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('sendOnce is idempotent on the key (COM-02)', async () => {
    const key = `e2e-tx-${Date.now()}`;
    const first = await txEmail.sendOnce({
      idempotencyKey: key,
      to: 'x@e2e.test',
      subject: 'Test',
      template: EmailTemplate.WELCOME_EMAIL,
      templateData: { name: 'X' },
      tenantId: 'e2e',
      farmId: null,
      userId: null,
    });
    const second = await txEmail.sendOnce({
      idempotencyKey: key,
      to: 'x@e2e.test',
      subject: 'Test',
      template: EmailTemplate.WELCOME_EMAIL,
      templateData: { name: 'X' },
      tenantId: 'e2e',
      farmId: null,
      userId: null,
    });
    expect(first.sent).toBe(true);
    expect(second.sent).toBe(false);
    expect(
      await prisma.emailLog.count({ where: { idempotencyKey: key } }),
    ).toBe(1);
  });

  it('a welcome email fires once per owner on farm create (COM-01)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `tx-welcome-${Date.now()}@e2e.test`,
        name: 'Welcome Tester',
        isEmailVerified: true,
      },
      select: { id: true },
    });
    tempUserIds.push(user.id);
    await legal.recordConsent(user.id, []);

    const farm1 = await farmService.create(user.id, { name: 'TX Farm One' });
    tempFarmIds.push(farm1.id);
    const welcome = await prisma.emailLog.findFirst({
      where: { idempotencyKey: `welcome:${user.id}` },
    });
    expect(welcome?.template).toBe('WELCOME_EMAIL');

    // A second farm by the same owner must NOT re-welcome (idempotency key is
    // the user, not the farm).
    const farm2 = await farmService.create(user.id, { name: 'TX Farm Two' });
    tempFarmIds.push(farm2.id);
    expect(
      await prisma.emailLog.count({
        where: { idempotencyKey: `welcome:${user.id}` },
      }),
    ).toBe(1);
  });

  it('the expiry sweep emails the owner once per transition (COM-01)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `tx-expiry-${Date.now()}@e2e.test`,
        name: 'Expiry Tester',
        isEmailVerified: true,
      },
      select: { id: true },
    });
    tempUserIds.push(user.id);

    const farm = await prisma.farm.create({
      data: {
        name: 'TX Expiry Farm',
        slug: `tx-expiry-${Date.now()}`,
        ownerId: user.id,
      },
      select: { id: true },
    });
    tempFarmIds.push(farm.id);

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'Starter' },
      select: { id: true },
    });
    if (!plan) throw new Error('plans missing — run `pnpm seed`');
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const sub = await prisma.farmSubscription.create({
      data: {
        farmId: farm.id,
        subscriptionPlanId: plan.id,
        status: 'ACTIVE',
        startsAt: past,
        expiresAt: past,
      },
      select: { id: true },
    });

    await lifecycle.runExpirySweep();
    const key = `subscription_expiry:${sub.id}:PAST_DUE`;
    const email = await prisma.emailLog.findFirst({
      where: { idempotencyKey: key },
    });
    expect(email?.template).toBe('SUBSCRIPTION_EXPIRY');
    expect(email?.to).toContain('tx-expiry-');

    // Re-running the sweep must not re-mail (idempotent).
    await lifecycle.runExpirySweep();
    expect(
      await prisma.emailLog.count({ where: { idempotencyKey: key } }),
    ).toBe(1);
  });
});
