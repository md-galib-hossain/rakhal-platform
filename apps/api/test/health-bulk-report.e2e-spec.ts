import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-469 (MILESTONE 29) — `POST /health/cases/bulk`: one condition reported for several animals in one call
 * (an outbreak). Validation is all-or-nothing, an animal that already has an open case for the condition is skipped
 * (not an error), the cases are created in one transaction, and the farm gets ONE review task for the whole group.
 */
describe('Health — bulk sickness report (RAKHAL-469)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerId: string;
  const tag = `E2E-RAKHAL469-${Date.now()}`;
  const cattleIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const post = (body: Record<string, unknown>) =>
    request(server())
      .post(api('/health/cases/bulk'))
      .set(...auth(owner))
      .send(body);

  async function makeCow(suffix: string): Promise<string> {
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `${tag}-${suffix}`,
        gender: 'FEMALE',
        createdBy: ownerId,
      },
    });
    cattleIds.push(cow.id);
    return cow.id;
  }

  const casesFor = (ids: string[]) =>
    prisma.healthCase.findMany({
      where: { farmId: owner.farmId, cattleId: { in: ids }, deletedAt: null },
      orderBy: { caseCode: 'asc' },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    ownerId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
    await prisma.healthCase.deleteMany({
      where: { cattleId: { in: cattleIds } },
    });
    await prisma.task.deleteMany({
      where: { farmId: owner.farmId, details: { contains: tag } },
    });
    await prisma.cattle.updateMany({
      where: { id: { in: cattleIds } },
      data: { deletedAt: new Date() },
    });
    await ctx.app.close();
  });

  it('opens one case per animal, in one call, with distinct case codes', async () => {
    const a = await makeCow('a1');
    const b = await makeCow('a2');
    const c = await makeCow('a3');

    const res = await post({
      cattleIds: [a, b, c],
      condition: 'MASTITIS',
      note: `${tag} outbreak in the east shed`,
      priority: 'HIGH',
      symptoms: ['Udder Swelling'],
    }).expect(201);

    expect(res.body.data).toMatchObject({ createdCount: 3, skippedCount: 0 });
    expect(res.body.data.results.map((r: any) => r.status)).toEqual([
      'created',
      'created',
      'created',
    ]);

    const cases = await casesFor([a, b, c]);
    expect(cases).toHaveLength(3);
    expect(new Set(cases.map((x) => x.caseCode)).size).toBe(3);
    for (const created of cases) {
      expect(created).toMatchObject({
        condition: 'MASTITIS',
        careType: 'CURATIVE', // the default for a group report
        priority: 'HIGH',
        status: 'ACTIVE',
        reportedBy: ownerId,
      });
      expect(created.symptoms).toEqual(['Udder Swelling']);
    }
  });

  it('sends ONE review task for the whole outbreak, not one per animal', async () => {
    const ids = [await makeCow('t1'), await makeCow('t2'), await makeCow('t3')];
    await post({
      cattleIds: ids,
      condition: 'LAMENESS',
      priority: 'MEDIUM',
    }).expect(201);

    // The group task lists the tags it covers, so the ones covering this run's first cow are the group's own.
    const tasks = await prisma.task.findMany({
      where: { farmId: owner.farmId, details: { contains: `${tag}-t1` } },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Review reported sickness — 3 animals');
    expect(tasks[0].details).toContain(`${tag}-t3`);
  });

  it('skips an animal that already has an open case for the same condition', async () => {
    const sick = await makeCow('d1');
    const well = await makeCow('d2');
    await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId: sick,
        condition: 'KETOSIS',
        careType: 'CURATIVE',
        priority: 'LOW',
      })
      .expect(201);

    const res = await post({
      cattleIds: [sick, well],
      condition: 'KETOSIS',
      priority: 'LOW',
    }).expect(201);

    expect(res.body.data).toMatchObject({ createdCount: 1, skippedCount: 1 });
    expect(
      res.body.data.results.find((r: any) => r.cattleId === sick).status,
    ).toBe('skipped');
    expect(
      res.body.data.results.find((r: any) => r.cattleId === well).status,
    ).toBe('created');
    expect(await casesFor([sick])).toHaveLength(1); // still just the original
  });

  it('a different condition on a sick animal is a new case, not a duplicate', async () => {
    const cow = await makeCow('e1');
    await post({
      cattleIds: [cow],
      condition: 'FEVER',
      priority: 'LOW',
    }).expect(201);
    const res = await post({
      cattleIds: [cow],
      condition: 'INJURY',
      priority: 'LOW',
    }).expect(201);
    expect(res.body.data.createdCount).toBe(1);
    expect(await casesFor([cow])).toHaveLength(2);
  });

  it('counts a repeated id once', async () => {
    const cow = await makeCow('f1');
    const res = await post({
      cattleIds: [cow, cow, cow],
      condition: 'METRITIS',
      priority: 'LOW',
    }).expect(201);
    expect(res.body.data).toMatchObject({ createdCount: 1, skippedCount: 0 });
    expect(res.body.data.results).toHaveLength(1);
  });

  it('one unknown animal fails the whole call and writes nothing', async () => {
    const real = await makeCow('g1');
    const res = await post({
      cattleIds: [real, 'does-not-exist'],
      condition: 'MILK_FEVER',
      priority: 'LOW',
    });
    expect(res.status).toBe(404);
    expect(await casesFor([real])).toHaveLength(0);
  });

  it('refuses a report with neither a condition nor a note', async () => {
    const cow = await makeCow('h1');
    const res = await post({ cattleIds: [cow], priority: 'LOW' });
    expect(res.status).toBe(400);
    expect(await casesFor([cow])).toHaveLength(0);
  });

  it('validates the body: ids required, at most 100, priority required', async () => {
    await post({ cattleIds: [], condition: 'FEVER', priority: 'LOW' }).expect(
      400,
    );
    await post({
      cattleIds: Array.from({ length: 101 }, (_, i) => `id-${i}`),
      condition: 'FEVER',
      priority: 'LOW',
    }).expect(400);
    await post({ cattleIds: ['x'], condition: 'FEVER' }).expect(400);
    await post({ cattleIds: ['x'], condition: 'NOPE', priority: 'LOW' }).expect(
      400,
    );
  });

  it('is behind authentication', async () => {
    await request(server())
      .post(api('/health/cases/bulk'))
      .send({ cattleIds: ['x'], condition: 'FEVER', priority: 'LOW' })
      .expect(401);
  });
});
