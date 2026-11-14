import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-459a (MILESTONE 27) — the Feeding Grid's per-cow `lookahead[]`: an upcoming calving shows with its
 * days-to-go, the window is a tunable farm setting, and a cow with nothing coming up gets an empty list.
 * (docs/EPIC_FEED_PROGRAMS.md, RAKHAL-459a.)
 *
 * Requires the dev stack up + `pnpm seed`. The pregnancy created here is deleted again in afterAll.
 */
describe('Feeding Grid look-ahead (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let cowSoon: string;
  let cowQuiet: string;
  const stamp = Date.now();
  const DAY = new Date().toISOString().slice(0, 10);

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const lookaheadOf = async (cattleId: string) => {
    const r = await request(server())
      .get(api(`/feed/grid?date=${DAY}`))
      .set(...auth(owner))
      .expect(200);
    const cow = (
      r.body.data.cows as Array<{
        cattle_id: string;
        lookahead: Array<{ kind: string; in_days: number }>;
      }>
    ).find((c) => c.cattle_id === cattleId);
    expect(cow).toBeDefined();
    return cow!.lookahead;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const mkCow = async (l: string) =>
      (
        await request(server())
          .post(api('/cattle'))
          .set(...auth(owner))
          .send({
            tagNumber: `E2E-LA-${l}-${stamp}`,
            gender: 'FEMALE',
            weightKg: 400,
          })
          .expect(201)
      ).body.data.id as string;
    [cowSoon, cowQuiet] = await Promise.all([mkCow('S'), mkCow('Q')]);

    const inDays = (n: number) =>
      new Date(new Date(`${DAY}T00:00:00.000Z`).getTime() + n * 86_400_000);
    await prisma.pregnancy.create({
      data: {
        cattleId: cowSoon,
        conceptionDate: inDays(-275),
        expectedCalvingDate: inDays(5),
        status: 'ACTIVE',
      },
    });
  }, 60_000);

  afterAll(async () => {
    await request(server())
      .delete(api('/feed/requirement-settings'))
      .set(...auth(owner));
    await prisma.pregnancy.deleteMany({ where: { cattleId: cowSoon } });
    await ctx.app.close();
  });

  it('lists an upcoming calving with its days-to-go, and nothing for a quiet cow', async () => {
    expect(await lookaheadOf(cowSoon)).toEqual([
      { kind: 'calving', in_days: 5 },
    ]);
    expect(await lookaheadOf(cowQuiet)).toEqual([]);
  });

  it('the window is a farm setting: shrinking it hides the event, resetting brings it back', async () => {
    await request(server())
      .put(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .send({ changes: { lookaheadDays: 3 } })
      .expect(200);
    expect(await lookaheadOf(cowSoon)).toEqual([]);

    await request(server())
      .put(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .send({ changes: { lookaheadDays: 90 } })
      .expect(400); // above the declared 1-60 bound

    await request(server())
      .delete(api('/feed/requirement-settings'))
      .set(...auth(owner))
      .expect(200);
    expect(await lookaheadOf(cowSoon)).toEqual([
      { kind: 'calving', in_days: 5 },
    ]);
  });
});
