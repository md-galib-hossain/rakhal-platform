import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-476: a positive pregnancy check with no breeding on file derives
 * conception from the gestation day (never the check date), and the
 * pregnancy-check lead time is a farm setting. Requires dev stack + `pnpm seed`.
 */
describe('RAKHAL-476 pregnancy estimates (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  const run = Date.now();
  const auth = (): [string, string] => [
    'Authorization',
    `Bearer ${owner.token}`,
  ];
  const api = (p: string) => `${ctx.prefix}${p}`;
  const day = (d: Date) => d.toISOString().slice(0, 10);

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('positive check, no AI, gestationDay=60: conception = check - 60, calving = +280', async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-476-${run}`,
        gender: 'FEMALE',
        createdBy: user.id,
      },
    });
    await request(ctx.app.getHttpServer())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth())
      .send({
        cattleId: cow.id,
        diagnosisDate: '2026-10-01T00:00:00.000Z',
        result: 'PREGNANT',
        diagnosisMethod: 'PALPATION',
        gestationDay: 60,
      })
      .expect(201);
    const p = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: cow.id },
    });
    expect(day(p.conceptionDate)).toBe('2026-08-02');
    expect(day(p.calculatedCalvingDate!)).toBe('2027-05-09');
    expect(day(p.expectedCalvingDate!)).toBe('2027-05-09');
  });

  it('exposes reproduction.pregnancy_check_days (default 35) on module settings', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(api('/settings/modules'))
      .set(...auth())
      .expect(200);
    expect(res.body.data.reproduction.pregnancy_check_days).toBe(35);
  });
});
