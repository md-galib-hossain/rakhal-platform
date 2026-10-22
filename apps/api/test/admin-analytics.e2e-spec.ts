import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';

/** Phase 6 usage analytics + CSV exports (formula injection, row cap, per-kind permissions, audit). */
describe('Admin analytics + exports (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminIds: string[] = [];
  let userId: string;
  let farmId: string;
  const evilName = `=HYPERLINK("http://evil.test/${stamp}","click")`;
  let superT: string;
  let billing: string;
  let support: string;
  let content: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const get = (p: string, t: string) =>
    request(server()).get(api(p)).set('Authorization', `Bearer ${t}`);
  const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `p6-an-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const password = 'P6AnE2Epass1234';
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `P6 ${role}`,
        passwordHash: await ctx.app.get(PasswordService).hashPassword(password),
        role,
        totpSecret: TOTP,
        totpEnabled: true,
      },
    });
    adminIds.push(admin.id);
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password, code: currentTotpCode(TOTP) })
      .expect(201);
    return dataOf<{ accessToken: string }>(res).accessToken;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    superT = await makeAdmin('SUPER_ADMIN');
    billing = await makeAdmin('BILLING_ADMIN');
    support = await makeAdmin('SUPPORT_ADMIN');
    content = await makeAdmin('CONTENT_ADMIN');

    // A farm whose name is a spreadsheet formula - the export must neutralise it.
    const user = await prisma.user.create({
      data: {
        email: `p6-an-owner-${stamp}@rakhal.test`,
        name: 'P6 Analytics Owner',
        passwordHash: await ctx.app
          .get(PasswordService)
          .hashPassword('P6OwnerE2Epass123'),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    userId = user.id;
    await ctx.app.get(LegalConsentService).recordConsent(userId, []);
    farmId = (await ctx.app.get(FarmService).create(userId, { name: evilName }))
      .id;
  }, 40_000);

  afterAll(async () => {
    await prisma.farmSubscription
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.farm.delete({ where: { id: farmId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('usage analytics: shape, internal consistency, permission', async () => {
    const res = await get('/admin/analytics/usage', support).expect(200);
    const u = dataOf<{
      subscriptions: {
        byPlan: { plan: string; counts: Record<string, number> }[];
      };
      mrr: { listPriceBdt: number };
      revenue: { windowDays: number; paidInvoices: number; totalBdt: number };
      activeFarms: { last7Days: number; last30Days: number };
      expiring: { farm: string; expiresAt: string }[];
    }>(res);
    expect(Array.isArray(u.subscriptions.byPlan)).toBe(true);
    expect(u.mrr.listPriceBdt).toBeGreaterThanOrEqual(0);
    expect(u.revenue.windowDays).toBe(30);
    expect(u.activeFarms.last7Days).toBeLessThanOrEqual(
      u.activeFarms.last30Days,
    );
    const times = u.expiring.map((e) => new Date(e.expiresAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times); // soonest first
    // The throwaway farm has a subscription, so it must appear in the per-plan totals.
    const total = u.subscriptions.byPlan
      .flatMap((p) => Object.values(p.counts))
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);

    await get('/admin/analytics/usage', content).expect(403);
    await request(server()).get(api('/admin/analytics/usage')).expect(401);
  });

  it('farms export: CSV headers, neutralised formulas, audited with a row count', async () => {
    const res = await get('/admin/exports/farms', billing).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="rakhal-farms-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    expect(res.headers['cache-control']).toBe('no-store');
    const text = res.text;
    expect(text.split('\r\n')[0]).toBe(
      'id,name,farm_code,status,division,district,owner_email,plan,subscription_status,expires_at,members,created_at',
    );
    // The formula name must be quoted-as-text, never a live formula cell.
    expect(text).toContain(`"'${evilName.replace(/"/g, '""')}"`);
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);

    const audit = await prisma.platformAdminAuditLog.findFirstOrThrow({
      where: { action: 'EXPORT_GENERATED', entityId: 'farms' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit.metadata as { rows: number }).rows).toBeGreaterThan(0);
  });

  it('subscriptions export works for BILLING; users export (PII) is SUPER only', async () => {
    const subs = await get('/admin/exports/subscriptions', billing).expect(200);
    expect(subs.text.split('\r\n')[0]).toBe(
      'farm_id,farm,plan,status,starts_at,expires_at,cancelled_at',
    );

    await get('/admin/exports/users', billing).expect(403);
    await get('/admin/exports/users', support).expect(403);
    const users = await get('/admin/exports/users', superT).expect(200);
    expect(users.text.split('\r\n')[0]).toBe(
      'id,name,email,email_verified,blocked,last_login_at,created_at',
    );
    expect(users.text).not.toMatch(/passwordHash|secret/i);
  });

  it('rejects unknown export kinds and unauthorised roles', async () => {
    await get('/admin/exports/passwords', superT).expect(400);
    await get('/admin/exports/farms', support).expect(403);
    await get('/admin/exports/farms', content).expect(403);
    await request(server()).get(api('/admin/exports/farms')).expect(401);
  });
});
