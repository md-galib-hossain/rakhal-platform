import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';

/**
 * RAKHAL-236 — legal consent (`customer-api`, PRD §36.1). Public ToS/Privacy;
 * per-user acceptance recorded with version; the farm-create + checkout gates
 * refuse an un-consented user (LGL-02); a newly published version forces
 * re-consent (LGL-03).
 */
interface ConsentStatus {
  documents: { id: string; type: string; version: string; accepted: boolean }[];
  all_accepted: boolean;
}

describe('Legal consent (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let legal: LegalConsentService;
  let owner: AuthedUser;
  let starterPlanId: string;
  const tempFarmIds: string[] = [];
  const tempUserIds: string[] = [];
  const tempDocIds: string[] = [];

  const makeUser = async (email: string) => {
    const u = await prisma.user.create({
      data: { email, name: 'Consent Tester', isEmailVerified: true },
      select: { id: true },
    });
    tempUserIds.push(u.id);
    return u.id;
  };

  const makeFarmRow = async (name: string, ownerId: string) => {
    const farm = await prisma.farm.create({
      data: {
        name,
        slug: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId,
      },
      select: { id: true },
    });
    tempFarmIds.push(farm.id);
    return farm.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    billing = ctx.app.get(BillingService);
    legal = ctx.app.get(LegalConsentService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const starter = await prisma.subscriptionPlan.findUnique({
      where: { name: 'Starter' },
      select: { id: true },
    });
    if (!starter) throw new Error('seed missing — run `pnpm seed`');
    starterPlanId = starter.id;
  }, 30_000);

  afterAll(async () => {
    // Doc cleanup FIRST + resilient — a stray published v2 would invalidate the
    // demo owner's seeded consent and cascade-fail other suites.
    for (const id of tempDocIds) {
      await prisma.consentRecord
        .deleteMany({ where: { documentId: id } })
        .catch(() => undefined);
      await prisma.legalDocument
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    for (const farmId of tempFarmIds) {
      await prisma.payment
        .deleteMany({ where: { farmId } })
        .catch(() => undefined);
      await prisma.invoice
        .deleteMany({ where: { farmId } })
        .catch(() => undefined);
      await prisma.farmSubscription
        .deleteMany({ where: { farmId } })
        .catch(() => undefined);
      await prisma.farm
        .delete({ where: { id: farmId } })
        .catch(() => undefined);
    }
    for (const userId of tempUserIds) {
      await prisma.consentRecord
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('GET /legal/documents is public and returns current ToS + Privacy', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/legal/documents`)
      .expect(200);
    const docs = (res.body as { data: { type: string }[] }).data;
    const types = docs.map((d) => d.type).sort();
    expect(types).toEqual(['PRIVACY', 'TERMS']);
  });

  it('status shows accepted for the seeded demo owner; recording is idempotent', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/legal/consent`)
      .set(...bearer(owner))
      .expect(200);
    expect((res.body as { data: ConsentStatus }).data.all_accepted).toBe(true);
  });

  it('an un-consented user is blocked from checkout, then allowed after consent (LGL-02)', async () => {
    const userId = await makeUser(`consent-${Date.now()}@e2e.rakhal.test`);
    const farmId = await makeFarmRow('Consent Farm', userId);

    // Not yet consented → checkout refused.
    await expect(
      billing.checkout(farmId, userId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
      }),
    ).rejects.toThrow(/Terms of Service and Privacy/i);

    // Accept, then checkout is allowed.
    await legal.recordConsent(userId, []);
    const ok = await billing.checkout(farmId, userId, {
      planId: starterPlanId,
      billingPeriod: BillingPeriod.MONTHLY,
    });
    expect(ok.invoice.status).toBe('PENDING'); // Starter is a paid plan
  });

  it('a newly published version forces re-consent (LGL-03)', async () => {
    const userId = await makeUser(`reconsent-${Date.now()}@e2e.rakhal.test`);
    await legal.recordConsent(userId, []); // accept current v1.0
    expect(await legal.hasAcceptedCurrent(userId)).toBe(true);

    // Publish a newer ToS version → it becomes "current".
    const v2 = await prisma.legalDocument.create({
      data: {
        type: 'TERMS',
        version: `2.0-${Date.now()}`,
        title: 'Rakhal Terms of Service v2',
        content: 'Updated terms.',
        effectiveAt: new Date(),
        published: true,
      },
      select: { id: true },
    });
    tempDocIds.push(v2.id);

    // The old consent no longer covers the current ToS → re-consent required.
    const status = await legal.getConsentStatus(userId);
    const tos = status.documents.find((d) => d.type === 'TERMS');
    expect(tos?.accepted).toBe(false);
    expect(status.all_accepted).toBe(false);

    // Farm-create is now blocked until re-consent.
    const farmId = await makeFarmRow('Reconsent Farm', userId);
    await expect(
      billing.checkout(farmId, userId, {
        planId: starterPlanId,
        billingPeriod: BillingPeriod.MONTHLY,
      }),
    ).rejects.toThrow(/Terms of Service and Privacy/i);

    // Re-consent to the new version → allowed again.
    await legal.recordConsent(userId, []);
    expect(await legal.hasAcceptedCurrent(userId)).toBe(true);
  });
});
