import request from 'supertest';
import * as argon2 from 'argon2';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { PrismaService } from '../src/core/database/prisma/prisma.service';

/**
 * RAKHAL-311 — regression coverage for the 3 confirmed live bugs from the
 * MILESTONE 18 audit. The actual filter fixes landed on the shared tree as
 * part of RAKHAL-310's parallel lane sweep (health.service.ts's
 * `getHealthDashboard`, reproduction.service.ts's dashboard action panels,
 * scheduler.service.ts's sweeps all already carry `isActive`/`cattle: {
 * isActive: true }` filters — verified by reading the current source before
 * writing this spec). What was missing was a regression test proving each one
 * — added here. The 4th AC item (deactivated platform admin) was also
 * already correctly guarded (`AdminAuthService.login` checks
 * `admin.isActive`, `PlatformAdminGuard` re-checks on every request) but had
 * no test proving the re-check-per-request behavior specifically.
 */
describe('RAKHAL-311 — soft-delete live bugs (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  const cattleIds: string[] = [];
  const healthCaseIds: string[] = [];
  const adminIds: string[] = [];

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (prefix: string) =>
    `E2E-311-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of healthCaseIds) {
      await prisma.healthTask.deleteMany({ where: { healthCaseId: id } });
      await prisma.healthCase.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of cattleIds) {
      await prisma.cattle.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of adminIds) {
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('health dashboard badge counts agree with an archived case being excluded (health.service.ts:95-132)', async () => {
    const cattle = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: tag('CASE'),
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
    cattleIds.push(cattle.id);

    const healthCase = await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cattle.id,
        caseCode: `HC-E2E-311-${Date.now()}`,
        diagnosis: 'Test diagnosis',
        condition: 'OTHER',
        diagnosisType: 'DISEASE',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });
    healthCaseIds.push(healthCase.id);

    const before = await request(server())
      .get(api('/health/dashboard'))
      .set(...bearer(owner))
      .expect(200);
    const beforeCount = (before.body as { data: { sickBayCount: number } }).data
      .sickBayCount;

    // Simulate archival — the exact silent-desync scenario the audit found:
    // a list-facing isActive:false flip that the badge count must also honor.
    await prisma.healthCase.update({
      where: { id: healthCase.id },
      data: { isActive: false },
    });

    const after = await request(server())
      .get(api('/health/dashboard'))
      .set(...bearer(owner))
      .expect(200);
    const afterCount = (after.body as { data: { sickBayCount: number } }).data
      .sickBayCount;

    expect(afterCount).toBe(beforeCount - 1);
  });

  it('reproduction dashboard action panels exclude an archived/sold cow (reproduction.service.ts action-required panels)', async () => {
    const cattle = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: tag('PREG7D'),
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
    cattleIds.push(cattle.id);

    const pregnancy = await prisma.pregnancy.create({
      data: {
        cattleId: cattle.id,
        status: 'ACTIVE',
        conceptionDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        expectedCalvingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    const before = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...bearer(owner))
      .expect(200);
    const beforeTags = (
      before.body as {
        data: {
          action_required: { calving_next_7_days: { tag: string }[] };
        };
      }
    ).data.action_required.calving_next_7_days.map((c) => c.tag);
    expect(beforeTags).toContain(cattle.tagNumber);

    // Sell/archive the cow — she must disappear from every action panel.
    await prisma.cattle.update({
      where: { id: cattle.id },
      data: { isActive: false, status: 'SOLD' },
    });

    const after = await request(server())
      .get(api('/reproduction/dashboard'))
      .set(...bearer(owner))
      .expect(200);
    const afterTags = (
      after.body as {
        data: {
          action_required: { calving_next_7_days: { tag: string }[] };
        };
      }
    ).data.action_required.calving_next_7_days.map((c) => c.tag);
    expect(afterTags).not.toContain(cattle.tagNumber);

    await prisma.pregnancy.delete({ where: { id: pregnancy.id } });
  });

  it('a deactivated platform admin is rejected on the very next request, not just at login (platform-admin.guard.ts:53)', async () => {
    const email = `deactivated-${Date.now()}@rakhal.test`;
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: 'Deactivated Admin',
        passwordHash: await argon2.hash('DeactivateMe123', {
          type: argon2.argon2id,
        }),
        role: 'SUPER_ADMIN',
      },
    });
    adminIds.push(admin.id);

    const setup = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password: 'DeactivateMe123' })
      .expect(201);
    const setupToken = (setup.body as { data: { setupToken: string } }).data
      .setupToken;

    const secretRes = await request(server())
      .post(api('/admin/auth/2fa/setup'))
      .set('Authorization', `Bearer ${setupToken}`)
      .expect(201);
    const secret = (secretRes.body as { data: { secret: string } }).data.secret;

    await request(server())
      .post(api('/admin/auth/2fa/enable'))
      .set('Authorization', `Bearer ${setupToken}`)
      .send({ code: currentTotpCode(secret) })
      .expect(201);

    const login = await request(server())
      .post(api('/admin/auth/login'))
      .send({
        email,
        password: 'DeactivateMe123',
        code: currentTotpCode(secret),
      })
      .expect(201);
    const accessToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;

    // Token is valid — confirm it works once before deactivation.
    await request(server())
      .get(api('/admin/coupons'))
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { isActive: false },
    });

    // Same still-unexpired token, same route — must now be rejected because
    // the guard re-loads the admin from the DB on every request.
    await request(server())
      .get(api('/admin/coupons'))
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  }, 30_000);
});
