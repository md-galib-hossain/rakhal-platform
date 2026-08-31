import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { MilkDisposition, MilkSession } from '@prisma/client';

/**
 * RD-058 — `GET /milk/anomalies` used to `findMany` every flagged row for the
 * farm with no `take`, so a farm with 200+ anomalies loaded them all in one
 * response (plus an N+1 `sessionAvg` call per row). Now cursor-paginated via
 * the shared `CursorPaginationQueryDto`/`getCursorArgs`/`toCursorPage` helpers,
 * same convention every other list endpoint in this repo uses.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Milk anomalies — cursor pagination (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;
  let cattleId: string;
  let ownerUserId: string;
  const createdIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  // Far-future, randomized dates so this suite never collides with seeded
  // data or another concurrent agent's e2e run against the same shared dev DB.
  const baseOffset = 500 + Math.floor(Math.random() * 1000); // days from now
  const testDates = [0, 1, 2].map(
    (i) => new Date(Date.now() + (baseOffset + i) * 24 * 60 * 60 * 1000),
  );

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

    const logTable = await request(server())
      .get(api('/milk/log'))
      .set(...auth(owner))
      .expect(200);
    const eligible = (
      logTable.body.data.entries as Array<{
        cattleId: string;
        withholding: boolean;
      }>
    ).find((e) => !e.withholding);
    if (!eligible) {
      throw new Error(
        'No non-withheld milking cow found in demo data — did you run `pnpm seed`?',
      );
    }
    cattleId = eligible.cattleId;

    // Seed 3 pre-flagged anomaly rows directly (avoids re-deriving 7-day
    // averages through real saveLog() calls just to trip the threshold).
    for (const logDate of testDates) {
      const row = await prisma.milkLogEntry.create({
        data: {
          farmId: owner.farmId,
          cattleId,
          logDate,
          session: MilkSession.EVENING,
          yieldL: 2,
          disposition: MilkDisposition.SALEABLE,
          anomalyFlag: true,
          createdBy: ownerUserId,
        },
      });
      createdIds.push(row.id);
    }
  }, 30_000);

  afterAll(async () => {
    await prisma.milkLogEntry.deleteMany({
      where: { id: { in: createdIds } },
    });
    await ctx.app.close();
  });

  it('pages through flagged anomalies via cursor, never returning more than `limit`', async () => {
    const first = await request(server())
      .get(api('/milk/anomalies?limit=2&sortOrder=desc'))
      .set(...auth(owner))
      .expect(200);

    const firstIds: string[] = first.body.data.map((a: { id: string }) => a.id);
    expect(first.body.data.length).toBeLessThanOrEqual(2);
    expect(first.body.meta.limit).toBe(2);
    expect(first.body.meta.endCursor).toBeTruthy();

    const collected = [...firstIds];
    let cursor = first.body.meta.endCursor as string;
    let hasNext = first.body.meta.hasNextPage as boolean;
    let guard = 0;
    while (hasNext && guard < 10) {
      const next = await request(server())
        .get(api(`/milk/anomalies?limit=2&sortOrder=desc&cursor=${cursor}`))
        .set(...auth(owner))
        .expect(200);
      collected.push(...next.body.data.map((a: { id: string }) => a.id));
      cursor = next.body.meta.endCursor;
      hasNext = next.body.meta.hasNextPage;
      guard += 1;
    }

    // Every seeded row surfaces exactly once across the walked pages, proving
    // the keyset cursor doesn't skip or duplicate rows for this farm.
    for (const id of createdIds) {
      expect(collected.filter((c) => c === id)).toHaveLength(1);
    }
  });
});
