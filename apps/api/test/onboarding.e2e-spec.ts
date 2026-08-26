import request from 'supertest';
import { Workbook } from 'exceljs';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SYSTEM_ROLES } from 'src/modules/permission/domain/permission-catalogue';
import { PLAN_NAMES } from 'src/modules/subscription/domain/subscription-features';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Onboarding e2e (RAKHAL-022/023/025): status/complete flag, configure (reuses
 * Settings), and the accept-invite loop (token → membership) that closes the
 * RAKHAL-030 gap. Requires the dev stack + `pnpm seed`.
 */
describe('Onboarding (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const uniquePhone = (): string => `017${String(Date.now()).slice(-8)}`;
  const uniqueEmail = (label: string): string =>
    `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@demo.rakhal.test`;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('status + complete', () => {
    it('owner reads onboarding status with step hints', async () => {
      const res = await request(server())
        .get(api('/onboarding/status'))
        .set(...auth(owner))
        .expect(200);
      expect(typeof res.body.data.has_completed_onboarding).toBe('boolean');
      expect(res.body.data.steps.farm.done).toBe(true);
    });

    it('complete sets the flag (then restores for idempotency)', async () => {
      const original = (
        await request(server())
          .get(api('/onboarding/status'))
          .set(...auth(owner))
      ).body.data.has_completed_onboarding as boolean;
      try {
        const res = await request(server())
          .post(api('/onboarding/complete'))
          .set(...auth(owner))
          .expect(201);
        expect(res.body.data.has_completed_onboarding).toBe(true);
      } finally {
        await prisma.farm.update({
          where: { id: owner.farmId },
          data: { hasCompletedOnboarding: original },
        });
      }
    });

    it('worker cannot complete onboarding (FORBIDDEN)', async () => {
      await request(server())
        .post(api('/onboarding/complete'))
        .set(...auth(worker))
        .expect(403);
    });
  });

  describe('configure', () => {
    it('owner configures milk sessions (capture + restore)', async () => {
      const original = (
        await request(server())
          .get(api('/settings/modules'))
          .set(...auth(owner))
      ).body.data.milk.active_sessions as string[];
      try {
        const res = await request(server())
          .post(api('/onboarding/configure'))
          .set(...auth(owner))
          .send({ active_sessions: ['morning', 'noon', 'evening'] })
          .expect(201);
        expect(res.body.data.sessions_configured).toEqual([
          'morning',
          'noon',
          'evening',
        ]);
      } finally {
        await request(server())
          .patch(api('/settings/modules'))
          .set(...auth(owner))
          .send({ milk: { active_sessions: original } });
      }
    });
  });

  describe('accept-invite', () => {
    // The shared demo farm has accumulated 50+ members/invites across parallel
    // sessions' own live-testing (documented drift in docs/IN_FLIGHT.md) and
    // currently sits on a plan with a real seat ceiling — exactly the B5 seat
    // check this suite added would (correctly) reject invites against it. So
    // invite/accept tests run against a dedicated scratch farm on Pro
    // (unlimited seats) instead, owned by the same demo owner user.
    let inviteFarmId: string;
    let inviteOwner: AuthedUser;

    beforeAll(async () => {
      const ownerRole = await prisma.role.findFirstOrThrow({
        where: { name: SYSTEM_ROLES.OWNER, farmId: null, isSystemRole: true },
        select: { id: true },
      });
      const ownerUser = await prisma.user.findUniqueOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      });
      const proPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
        where: { name: PLAN_NAMES.PRO },
        select: { id: true },
      });

      const farm = await prisma.farm.create({
        data: {
          name: 'E2E Invite Farm',
          slug: `e2e-invite-farm-${Date.now()}`,
          ownerId: ownerUser.id,
          members: { create: { userId: ownerUser.id, roleId: ownerRole.id } },
        },
        select: { id: true },
      });
      inviteFarmId = farm.id;
      await prisma.farmSubscription.create({
        data: {
          farmId: farm.id,
          subscriptionPlanId: proPlan.id,
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt: null,
        },
      });

      const login = await request(server()).post(api('/auth/login')).send({
        email: 'owner@demo.rakhal.test',
        password: 'DemoPass123',
        farmId: inviteFarmId,
      });
      inviteOwner = {
        token: login.body.data.accessToken as string,
        farmId: inviteFarmId,
      };
    });

    afterAll(async () => {
      await prisma.farmMember.deleteMany({ where: { farmId: inviteFarmId } });
      await prisma.farmInvitation.deleteMany({
        where: { farmId: inviteFarmId },
      });
      await prisma.farmSubscription.deleteMany({
        where: { farmId: inviteFarmId },
      });
      await prisma.farm.delete({ where: { id: inviteFarmId } });
    });

    it('401 without auth, 400 on a too-short token', async () => {
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .send({ token: 'whatever-token' })
        .expect(401);

      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(owner))
        .send({ token: 'short' })
        .expect(400);
    });

    it('404 on an unknown token', async () => {
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(owner))
        .send({ token: 'definitely-not-a-real-invite-token' })
        .expect(404);
    });

    it('409 when the accepting user is already a member', async () => {
      // Must invite the owner's own real email — B3's redeemer-email-match
      // check runs before the already-a-member check, so a mismatched email
      // would 403 first rather than exercising this case.
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(inviteOwner))
        .send({ email: 'owner@demo.rakhal.test', role: 'Worker' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { email: 'owner@demo.rakhal.test', status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(inviteOwner))
        .send({ token: invite!.token })
        .expect(409);
    });

    it('403 when a different account tries to redeem the token', async () => {
      const invitedEmail = uniqueEmail('invited');
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(inviteOwner))
        .send({ email: invitedEmail, role: 'Worker' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { email: invitedEmail, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });

      // A different, unrelated fresh account holding the token must be rejected.
      const strangerEmail = uniqueEmail('stranger');
      const password = 'Str0ng!Pass123';
      await request(server())
        .post(api('/auth/register'))
        .send({ email: strangerEmail, name: 'Stranger', password })
        .expect(201);
      const strangerToken = (
        await request(server())
          .post(api('/auth/login'))
          .send({ email: strangerEmail, password, farmId: 'bootstrap' })
      ).body.data.accessToken as string;

      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ token: invite!.token })
        .expect(403);
    });

    it('a fresh user previews then redeems an invite and joins the farm', async () => {
      const email = uniqueEmail('invitee');
      const password = 'Str0ng!Pass123';

      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(inviteOwner))
        .send({ email, role: 'Worker', name: 'Invited User' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { email, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });

      // Unauthenticated preview — the accept page can render before signup.
      const preview = await request(server())
        .get(api(`/onboarding/invites/${invite!.token}`))
        .expect(200);
      expect(preview.body.data.role).toBe('worker');
      expect(preview.body.data.status).toBe('pending');

      await request(server())
        .post(api('/auth/register'))
        .send({ email, name: 'Invited User', password })
        .expect(201);
      const freshToken = (
        await request(server())
          .post(api('/auth/login'))
          .send({ email, password, farmId: 'bootstrap' })
      ).body.data.accessToken as string;

      const accepted = await request(server())
        .post(api('/onboarding/accept-invite'))
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ token: invite!.token })
        .expect(201);
      expect(accepted.body.data.farm_id).toBe(inviteFarmId);
      expect(accepted.body.data.role).toBe('worker');

      // The invitee can now see the farm they joined.
      const farms = await request(server())
        .get(api('/farms'))
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);
      expect(
        (farms.body.data as Array<{ id: string }>).some(
          (f) => f.id === inviteFarmId,
        ),
      ).toBe(true);
    });

    it('rejects an invite once the plan seat ceiling is reached (B5: at invite time, not accept)', async () => {
      const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({
        where: { name: PLAN_NAMES.FREE },
        select: { id: true, maxFarmMembers: true },
      });
      // Temporarily drop this scratch farm to Free (2 seats) to exercise the
      // ceiling deterministically, then restore Pro in `finally`.
      await prisma.farmSubscription.create({
        data: {
          farmId: inviteFarmId,
          subscriptionPlanId: freePlan.id,
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt: null,
        },
      });
      const access = ctx.app.get(SubscriptionAccessService);
      await access.invalidateFarm(inviteFarmId);

      try {
        // Farm already has 1 member (the owner) + invites created by earlier
        // tests in this block — Free's ceiling is 2, so this must 403.
        await request(server())
          .post(api('/settings/team/invite'))
          .set(...auth(inviteOwner))
          .send({ email: uniqueEmail('over_seat_limit'), role: 'Worker' })
          .expect(403);
      } finally {
        const proPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
          where: { name: PLAN_NAMES.PRO },
          select: { id: true },
        });
        await prisma.farmSubscription.create({
          data: {
            farmId: inviteFarmId,
            subscriptionPlanId: proPlan.id,
            status: 'ACTIVE',
            startsAt: new Date(),
            expiresAt: null,
          },
        });
        await access.invalidateFarm(inviteFarmId);
      }
    });

    it('owner can revoke a pending invite', async () => {
      const email = uniqueEmail('to_revoke');
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(inviteOwner))
        .send({ email, role: 'Worker' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { email, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, token: true },
      });

      await request(server())
        .delete(api(`/settings/team/invites/${invite!.id}`))
        .set(...auth(inviteOwner))
        .expect(200);

      const preview = await request(server())
        .get(api(`/onboarding/invites/${invite!.token}`))
        .expect(200);
      expect(preview.body.data.status).toBe('revoked');
      // Revoked invites are never PENDING again, so accepting the token now
      // must fail past the ACCEPTED/PENDING check.
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set(...auth(inviteOwner))
        .send({ token: invite!.token })
        .expect(400);
    });

    it('owner can change a member role', async () => {
      const email = uniqueEmail('to_promote');
      const password = 'Str0ng!Pass123';
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(inviteOwner))
        .send({ email, role: 'Worker', name: 'To Promote' })
        .expect(201);
      const invite = await prisma.farmInvitation.findFirst({
        where: { email, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { token: true },
      });
      await request(server())
        .post(api('/auth/register'))
        .send({ email, name: 'To Promote', password })
        .expect(201);
      const freshToken = (
        await request(server())
          .post(api('/auth/login'))
          .send({ email, password, farmId: 'bootstrap' })
      ).body.data.accessToken as string;
      await request(server())
        .post(api('/onboarding/accept-invite'))
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ token: invite!.token })
        .expect(201);

      const member = await prisma.farmMember.findFirst({
        where: { farmId: inviteFarmId, user: { email } },
        select: { id: true },
      });

      await request(server())
        .patch(api(`/settings/team/${member!.id}/role`))
        .set(...auth(inviteOwner))
        .send({ role: 'Manager' })
        .expect(200);

      const updated = await prisma.farmMember.findUniqueOrThrow({
        where: { id: member!.id },
        include: { role: { select: { name: true } } },
      });
      expect(updated.role.name).toBe('Manager');
    });
  });

  describe('farm create — onboarding fields (RAKHAL-021 remainder)', () => {
    let legal: LegalConsentService;
    const tempUserIds: string[] = [];
    const tempFarmIds: string[] = [];

    beforeAll(() => {
      legal = ctx.app.get(LegalConsentService);
    });

    afterAll(async () => {
      await prisma.farmMember.deleteMany({
        where: { farmId: { in: tempFarmIds } },
      });
      await prisma.farmSubscription.deleteMany({
        where: { farmId: { in: tempFarmIds } },
      });
      for (const fid of tempFarmIds) {
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
    });

    /** Register + accept current legal docs (LGL-02 gate) so `POST /farms` proceeds. */
    async function registerAndConsent(email: string): Promise<string> {
      const password = 'Str0ng!Pass123';
      await request(server())
        .post(api('/auth/register'))
        .send({ email, name: 'E2E Farm Create', password })
        .expect(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
      tempUserIds.push(user.id);
      await legal.recordConsent(user.id, []);
      const login = await request(server())
        .post(api('/auth/login'))
        .send({ email, password, farmId: 'bootstrap' });
      return login.body.data.accessToken as string;
    }

    it('creates a farm with location/purpose/herd-size fields and a generated PREFIX-YEAR-SERIAL farm code', async () => {
      const token = await registerAndConsent(uniqueEmail('farmcreate_full'));

      const res = await request(server())
        .post(api('/farms'))
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Green Valley Dairy',
          division: 'Dhaka',
          district: 'Gazipur',
          upazila: 'Sreepur',
          operationalherdSizeBand: '51-200',
          cattleIdPrefix: 'gvd',
        })
        .expect(201);
      tempFarmIds.push(res.body.data.id as string);

      expect(res.body.data.cattleIdPrefix).toBe('GVD');
      expect(res.body.data.herdSizeBand).toBe('51-200');
      expect(res.body.data.division).toBe('Dhaka');
      expect(res.body.data.district).toBe('Gazipur');
      expect(res.body.data.upazila).toBe('Sreepur');
      expect(res.body.data.operationalPurpose).toBe('Dairy');
      const year = new Date().getFullYear();
      expect(res.body.data.farmCode as string).toMatch(
        new RegExp(`^GVD-${year}-\\d{3}$`),
      );
    });

    it('derives the ID prefix from the farm name when omitted', async () => {
      const token = await registerAndConsent(uniqueEmail('farmcreate_derive'));

      const res = await request(server())
        .post(api('/farms'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sunrise Dairy Farm' })
        .expect(201);
      tempFarmIds.push(res.body.data.id as string);

      expect(res.body.data.cattleIdPrefix).toBe('SDF');
      expect(res.body.data.farmCode as string).toMatch(/^SDF-\d{4}-\d{3}$/);
    });

    it('rejects an invalid herd-size band', async () => {
      const token = await registerAndConsent(uniqueEmail('farmcreate_badband'));

      await request(server())
        .post(api('/farms'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad Band Farm', herdSizeBand: '9999-plus' })
        .expect(400);
    });

    it('assigns unique, increasing serials to two farms sharing a prefix', async () => {
      const token1 = await registerAndConsent(uniqueEmail('farmcreate_seq1'));
      const res1 = await request(server())
        .post(api('/farms'))
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'Sequential One', cattleIdPrefix: 'SEQ' })
        .expect(201);
      tempFarmIds.push(res1.body.data.id as string);

      const token2 = await registerAndConsent(uniqueEmail('farmcreate_seq2'));
      const res2 = await request(server())
        .post(api('/farms'))
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Sequential Two', cattleIdPrefix: 'SEQ' })
        .expect(201);
      tempFarmIds.push(res2.body.data.id as string);

      const code1 = res1.body.data.farmCode as string;
      const code2 = res2.body.data.farmCode as string;
      expect(code1).not.toBe(code2);
      const serial1 = Number(code1.split('-')[2]);
      const serial2 = Number(code2.split('-')[2]);
      // Not asserting exact adjacency — the shared dev DB may have other
      // parallel sessions creating farms concurrently (documented in
      // docs/IN_FLIGHT.md); only monotonic increase + uniqueness matter here.
      expect(serial2).toBeGreaterThan(serial1);
    });
  });

  describe('cattle import wrapper (RAKHAL-024)', () => {
    const xlsxRow = async (tag: string): Promise<Buffer> => {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Cattle');
      sheet.addRow(['Tag', 'Name', 'Breed', 'Gender', 'DateOfBirth']);
      sheet.addRow([tag, 'Onboard Cow', 'Local', 'FEMALE', '2023-01-01']);
      return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    };

    it('owner previews an Excel import via the onboarding wrapper', async () => {
      const res = await request(server())
        .post(api('/onboarding/cattle/import'))
        .set(...auth(owner))
        .attach('file', await xlsxRow(`E2E-ONB-${Date.now()}`), {
          filename: 'cattle.xlsx',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(typeof res.body.data.importSessionId).toBe('string');
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });

    it('worker cannot preview an onboarding cattle import (FORBIDDEN)', async () => {
      await request(server())
        .post(api('/onboarding/cattle/import'))
        .set(...auth(worker))
        .attach('file', await xlsxRow(`E2E-ONB-DENY-${Date.now()}`), {
          filename: 'cattle.xlsx',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(403);
    });

    it('400s confirming an unknown/expired import session', async () => {
      await request(server())
        .post(api('/onboarding/cattle/import/confirm'))
        .set(...auth(owner))
        .send({ importSessionId: 'not-a-real-session-id' })
        .expect(400);
    });
  });
});
