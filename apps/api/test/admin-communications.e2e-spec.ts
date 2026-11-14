import request from 'supertest';
import { PlatformAdminRole } from '@prisma/client';
import { createTestApp, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { purgeAdminAudit } from './utils/admin-audit';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/application/services/password.service';
import { LegalConsentService } from '../src/modules/compliance/application/services/legal-consent.service';
import { FarmService } from '../src/modules/farm/application/services/farm.service';

describe('Admin communications (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  const TOTP = 'JBSWY3DPEHPK3PXP';
  const stamp = Date.now();
  const adminPassword = 'P4SupportE2Epass1';
  const adminIds: string[] = [];
  const userIds: string[] = [];
  const farmIds: string[] = [];
  let superToken: string;

  const api = (p: string) => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  async function makeAdmin(role: PlatformAdminRole): Promise<string> {
    const email = `comm-${role.toLowerCase()}-${stamp}@rakhal.test`;
    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        name: `Comm ${role}`,
        passwordHash: await ctx.app
          .get(PasswordService)
          .hashPassword(adminPassword),
        role,
        totpSecret: TOTP,
        totpEnabled: true,
      },
    });
    adminIds.push(admin.id);
    const res = await request(server())
      .post(api('/admin/auth/login'))
      .send({ email, password: adminPassword, code: currentTotpCode(TOTP) })
      .expect(201);
    return (res.body as { data: { accessToken: string } }).data.accessToken;
  }

  async function makeTenant() {
    const passwords = ctx.app.get(PasswordService);
    const email = `comm-user-${stamp}-${userIds.length}@rakhal.test`;
    const password = 'CommUserPass123!';
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Comm User',
        passwordHash: await passwords.hashPassword(password),
        isEmailVerified: true,
      },
      select: { id: true },
    });
    userIds.push(user.id);
    await ctx.app.get(LegalConsentService).recordConsent(user.id, []);
    const farm = await ctx.app.get(FarmService).create(user.id, {
      name: `Comm Farm ${stamp} ${farmIds.length}`,
    });
    farmIds.push(farm.id);
    return { userId: user.id, farmId: farm.id };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    superToken = await makeAdmin(PlatformAdminRole.SUPER_ADMIN);
  }, 40000);

  afterAll(async () => {
    for (const id of adminIds) {
      await purgeAdminAudit(prisma, id);
      await prisma.platformAdminSession.deleteMany({ where: { adminId: id } });
      await prisma.platformAdmin
        .delete({ where: { id } })
        .catch(() => undefined);
    }
    for (const id of farmIds) {
      await prisma.notification.deleteMany({ where: { farmId: id } });
      await prisma.farmMember.deleteMany({ where: { farmId: id } });
      await prisma.farm.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of userIds) {
      await prisma.deviceToken.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('GET /admin/communications/stats returns channel statistics', async () => {
    const res = await request(server())
      .get(api('/admin/communications/stats'))
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    const body = res.body as {
      data?: { totalUsers: number; telegramSubscribers: number };
      totalUsers?: number;
    };
    const data = body.data ?? body;
    expect(data).toBeDefined();
    expect(typeof data.totalUsers).toBe('number');
    expect(typeof data.telegramSubscribers).toBe('number');
  });

  it('POST /admin/communications/users/:id/message sends direct communication to user', async () => {
    const tenant = await makeTenant();

    const res = await request(server())
      .post(api(`/admin/communications/users/${tenant.userId}/message`))
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        title: 'Platform Maintenance Notice',
        message: 'Scheduled maintenance will occur tonight at 02:00 AM UTC.',
      })
      .expect(200);

    const body = res.body as {
      data?: { delivered: boolean; recipient: { id: string } };
      success?: boolean;
      recipient?: { id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data?.recipient?.id).toBe(tenant.userId);

    const notif = await prisma.notification.findFirst({
      where: { userId: tenant.userId, eventKey: 'admin_broadcast' },
    });
    expect(notif).toBeDefined();
    expect(notif?.title).toBe('Platform Maintenance Notice');
  });

  it('POST /admin/communications/broadcast broadcasts announcement to targeted audience', async () => {
    const tenant = await makeTenant();

    const res = await request(server())
      .post(api('/admin/communications/broadcast'))
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        title: 'Urgent Weather Advisory',
        message:
          'Severe heatwave advisory: ensure adequate hydration for dairy herds.',
        targetAudience: 'all',
        targetUserIds: [tenant.userId],
      })
      .expect(200);

    const body = res.body as {
      data?: { targetedCount: number };
      success?: boolean;
      targetedCount?: number;
    };
    expect(body.success).toBe(true);
    expect(body.data?.targetedCount).toBe(1);
  });
});
