import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Reproduction events → Activity Log (PRD §19). Heat, breeding, return-to-heat,
 * non-confirming diagnoses, abortion, dry-off and purchased-lactation intake
 * each write an immutable `BREEDING`/no-AQR-impact entry naming the cow and the
 * acting user. Entries are found by a per-cow unique tag so the shared,
 * hash-chained dev-DB log can't cause false matches.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction → Activity Log (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const run = Date.now();

  interface LogRow {
    eventTitle: string;
    actionDetails: string;
    module: string;
    actorId: string | null;
    aqrImpact: number | null;
  }

  async function expectEntry(
    eventTitle: string,
    tag: string,
    detailsContain?: string,
  ): Promise<LogRow> {
    const res = await request(server())
      .get(api('/activity-log?module=BREEDING&limit=100'))
      .set(...auth(owner))
      .expect(200);
    const row = (res.body.data as LogRow[]).find(
      (r) => r.eventTitle === eventTitle && r.actionDetails.includes(tag),
    );
    expect(row).toBeDefined();
    expect(row!.module).toBe('BREEDING');
    expect(row!.actorId).toBe(ownerUserId);
    expect(row!.aqrImpact ?? null).toBeNull();
    if (detailsContain) expect(row!.actionDetails).toContain(detailsContain);
    return row!;
  }

  async function createCow(label: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RAL-${label}-${run}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

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
    await ctx.app.close();
  });

  it('logs heat detection and manual heat resolution', async () => {
    const cow = await createCow('HEAT');
    const heat = await request(server())
      .post(api('/reproduction/heat-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        heatDateTime: new Date().toISOString(),
        detectionMethod: 'VISUAL',
      })
      .expect(201);
    await expectEntry('Heat detected', cow.tagNumber, 'VISUAL');

    await request(server())
      .post(api(`/reproduction/heat-events/${heat.body.data.id}/resolve`))
      .set(...auth(owner))
      .send({ reason: 'FALSE_ALARM' })
      .expect(201);
    await expectEntry('Heat resolved', cow.tagNumber, 'FALSE_ALARM');
  });

  it('logs breeding, a NOT_PREGNANT diagnosis, and return-to-heat', async () => {
    const cow = await createCow('BREED');
    const breeding = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    await expectEntry('Breeding recorded', cow.tagNumber, 'NATURAL');

    await request(server())
      .post(
        api(
          `/reproduction/breeding-events/${breeding.body.data.id}/return-to-heat`,
        ),
      )
      .set(...auth(owner))
      .send({ heatDateTime: new Date().toISOString() })
      .expect(201);
    await expectEntry('Returned to heat', cow.tagNumber);

    const cow2 = await createCow('DIAG');
    const b2 = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow2.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    await request(server())
      .post(api('/reproduction/pregnancy-diagnoses'))
      .set(...auth(owner))
      .send({
        cattleId: cow2.id,
        breedingEventId: b2.body.data.id,
        diagnosisDate: new Date().toISOString(),
        result: 'NOT_PREGNANT',
        diagnosisMethod: 'PALPATION',
      })
      .expect(201);
    await expectEntry('Pregnancy diagnosis', cow2.tagNumber, 'NOT_PREGNANT');
  });

  it('logs purchased-lactation intake, dry-off and abortion', async () => {
    const cow = await createCow('LACT');
    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/purchased-lactation`))
      .set(...auth(owner))
      .send({})
      .expect(201);
    await expectEntry('Lactation started', cow.tagNumber);

    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({})
      .expect(201);
    await expectEntry('Dry-off recorded', cow.tagNumber);

    await request(server())
      .post(api('/reproduction/abortion-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        abortionDate: new Date().toISOString(),
      })
      .expect(201);
    await expectEntry('Abortion recorded', cow.tagNumber);
  });

  it('does not log a rejected request', async () => {
    const cow = await createCow('REJECT');
    await request(server())
      .post(api(`/reproduction/cattle/${cow.id}/dry-off`))
      .set(...auth(owner))
      .send({})
      .expect(400);
    const res = await request(server())
      .get(api('/activity-log?module=BREEDING&limit=100'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (res.body.data as LogRow[]).some((r) =>
        r.actionDetails.includes(cow.tagNumber),
      ),
    ).toBe(false);
  });
});
