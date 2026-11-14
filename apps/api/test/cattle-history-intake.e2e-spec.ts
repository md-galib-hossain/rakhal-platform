import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-483: `history[]` on POST /cattle. Walkthrough A (04 §5): last calving
 * and "pregnant" with no AI on file. Also the C7 fix: an intake AI needs no cost.
 * Requires dev stack + `pnpm seed`.
 */
describe('POST /cattle with history[] (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  const run = Date.now();
  const create = (key: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/cattle`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        tagNumber: `E2E-483-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: '2022-01-01',
        ...body,
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('walkthrough A: last calving + pregnant, no AI: HISTORICAL events, no cost, no tasks', async () => {
    const res = await create('A', {
      history: [
        { kind: 'LAST_CALVING', date: '2026-06-10', calvingNumber: 2 },
        { kind: 'PREGNANT', expectedCalvingDate: '2027-03-20' },
      ],
    }).expect(201);
    const id = (res.body as { data: { id: string } }).data.id;
    const events = await prisma.animalEvent.findMany({
      where: { cattleId: id },
      orderBy: { eventAt: 'asc' },
    });
    expect(events.map((e) => e.type)).toEqual(['CALVING', 'PREG_CHECK']);
    expect(events.every((e) => e.provenance === 'HISTORICAL')).toBe(true);
    const profile = await prisma.reproductionProfile.findUniqueOrThrow({
      where: { cattleId: id },
    });
    expect(profile.reproductiveStatus).toBe('PREGNANT');
    expect(await prisma.expense.count({ where: { cattleId: id } })).toBe(0);
    // Walkthrough A: only future reminders, never past-due ones (no preg check, no VWP end).
    const tasks = await prisma.task.findMany({
      where: { relatedCattleId: id },
      select: { ruleKey: true },
    });
    expect(tasks.map((t) => t.ruleKey).sort()).toEqual([
      'PREG_POSITIVE_TO_CALVING_WATCH',
      'PREG_POSITIVE_TO_DRY_OFF',
    ]);
    const p = await prisma.pregnancy.findFirstOrThrow({
      where: { cattleId: id },
    });
    expect(p.conceptionConfidence).toBe('ESTIMATED');
  });

  it('C7: an intake AI with no cost saves (was a 400 after the cow was created)', async () => {
    const res = await create('C7', {
      intakeBreeding: { breedingDate: '2026-10-01', breedingMethod: 'AI' },
    }).expect(201);
    const id = (res.body as { data: { id: string } }).data.id;
    const b = await prisma.breedingEvent.findFirstOrThrow({
      where: { cattleId: id },
    });
    expect(Number(b.serviceCost ?? 0)).toBe(0);
    const header = await prisma.animalEvent.findFirstOrThrow({
      where: { cattleId: id, type: 'BREEDING' },
    });
    expect(header.provenance).toBe('HISTORICAL');
  });

  it('a failing history item rolls the whole create back', async () => {
    const tag = `E2E-483-ROLL-${run}`;
    await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/cattle`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        tagNumber: tag,
        gender: 'MALE',
        dateOfBirth: '2022-01-01',
        history: [{ kind: 'LAST_CALVING', date: '2026-06-10' }],
      })
      .expect(422);
    expect(await prisma.cattle.count({ where: { tagNumber: tag } })).toBe(0);
  });
});
