import request from 'supertest';
import sharp from 'sharp';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';

/**
 * RAKHAL-242 — support feedback inbox + trial-abuse guard (PRD §36.7). Proves
 * SUP-01 (a farm member's feedback + screenshot lands in the `admin-api` triage
 * inbox, and a farm token can't reach it) and SUP-02 (a second farm by the same
 * owner gets no free trial). Runs on the in-memory media adapter (`NODE_ENV=test`).
 */
interface LoginResp {
  accessToken: string;
}
interface AdminFeedback {
  id: string;
  category: string;
  message: string;
  status: string;
  screenshot: { thumb_url: string } | null;
  resolved_at: string | null;
}

describe('Support feedback + trial-abuse (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let farmService: FarmService;
  let legal: LegalConsentService;
  let owner: AuthedUser;
  let adminToken: string;
  let feedbackId: string;
  let png: Buffer;
  let trialUserId: string;
  const tempFarmIds: string[] = [];

  const adminAuth = (): [string, string] => [
    'Authorization',
    `Bearer ${adminToken}`,
  ];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    farmService = ctx.app.get(FarmService);
    legal = ctx.app.get(LegalConsentService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const login = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/admin/auth/login`)
      .send({
        email: 'admin@rakhal.test',
        password: 'AdminPass123',
        code: currentTotpCode(),
      })
      .expect(201);
    adminToken = (login.body as { data: LoginResp }).data.accessToken;

    png = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 200, g: 210, b: 220 },
      },
    })
      .png()
      .toBuffer();
  }, 30_000);

  afterAll(async () => {
    await prisma.supportFeedback.deleteMany({
      where: { farmId: owner.farmId },
    });
    await prisma.mediaAsset.deleteMany({ where: { farmId: owner.farmId } });
    for (const fid of tempFarmIds) {
      await prisma.farmSubscription.deleteMany({ where: { farmId: fid } });
      await prisma.farmMember.deleteMany({ where: { farmId: fid } });
      await prisma.farm.delete({ where: { id: fid } }).catch(() => undefined);
    }
    if (trialUserId) {
      await prisma.trialGrant.deleteMany({ where: { userId: trialUserId } });
      await prisma.consentRecord.deleteMany({ where: { userId: trialUserId } });
      await prisma.user
        .delete({ where: { id: trialUserId } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('rejects unauthenticated feedback (401)', async () => {
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/feedback`)
      .field('category', 'BUG')
      .field('message', 'anonymous cannot post')
      .expect(401);
  });

  it('a farm member submits feedback with a screenshot (201)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/feedback`)
      .set(...bearer(owner))
      .field('category', 'BUG')
      .field('message', 'The milk log screen crashes on submit.')
      .attach('file', png, { filename: 'shot.png', contentType: 'image/png' })
      .expect(201);
    const data = (res.body as { data: { id: string; status: string } }).data;
    expect(data.status).toBe('OPEN');
    feedbackId = data.id;
  });

  it('a farm token cannot reach the admin triage inbox (401)', async () => {
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/feedback`)
      .set(...bearer(owner))
      .expect(401);
  });

  it('the feedback lands in the admin inbox with its screenshot', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/admin/feedback`)
      .set(...adminAuth())
      .query({ status: 'OPEN' })
      .expect(200);
    const items = (res.body as { data: AdminFeedback[] }).data;
    const found = items.find((f) => f.id === feedbackId);
    expect(found).toBeDefined();
    expect(found?.category).toBe('BUG');
    expect(found?.screenshot?.thumb_url).toBeTruthy();
  });

  it('admin triages it to RESOLVED', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`${ctx.prefix}/admin/feedback/${feedbackId}`)
      .set(...adminAuth())
      .send({ status: 'RESOLVED', adminNote: 'Fixed in 1.2.1' })
      .expect(200);
    const data = (res.body as { data: AdminFeedback }).data;
    expect(data.status).toBe('RESOLVED');
    expect(data.resolved_at).toBeTruthy();
  });

  it('one free trial per owner — a second farm gets no trial (SUP-02)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `trial-abuse-${Date.now()}@e2e.test`,
        name: 'Trial Abuse Tester',
        isEmailVerified: true,
      },
      select: { id: true },
    });
    trialUserId = user.id;
    await legal.recordConsent(user.id, []); // pass the LGL-02 gate

    const farm1 = await farmService.create(user.id, { name: 'Trial Farm One' });
    tempFarmIds.push(farm1.id);
    const sub1 = await prisma.farmSubscription.findFirst({
      where: { farmId: farm1.id },
    });
    expect(sub1?.status).toBe('TRIALING'); // first farm → trial
    expect(await prisma.trialGrant.count({ where: { userId: user.id } })).toBe(
      1,
    );

    const farm2 = await farmService.create(user.id, { name: 'Trial Farm Two' });
    tempFarmIds.push(farm2.id);
    const sub2 = await prisma.farmSubscription.findFirst({
      where: { farmId: farm2.id },
    });
    expect(sub2).toBeNull(); // second farm by the same owner → no free trial
  });
});
