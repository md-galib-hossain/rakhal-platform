import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * `GET /reproduction/events` — composite keyset cursor over the merged
 * heat/breeding/calving/abortion/pregnancy-diagnosis stream (previously the
 * endpoint ignored `cursor` and silently returned only the newest `limit` rows).
 *
 * The fixture deliberately stacks events on IDENTICAL timestamps — including
 * across two tables (heat + abortion) — because that is where a naive date-only
 * keyset drops or repeats rows. Requires the dev stack up + `pnpm seed`.
 */
describe('Reproduction — GET /reproduction/events cursor (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let cattleId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const T2 = new Date('2001-03-03T10:00:00.000Z');
  const T1 = new Date('2001-03-02T10:00:00.000Z');
  const T0 = new Date('2001-03-01T10:00:00.000Z');

  interface Row {
    id: string;
    event_type: string;
    event_date: string;
  }
  interface Page {
    items: Row[];
    meta: { hasNextPage: boolean; endCursor: string | null; count: number };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-EVP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: user.id,
      },
    });
    cattleId = cow.id;

    const heat = (heatDateTime: Date) =>
      prisma.heatEvent.create({
        data: { cattleId, heatDateTime, detectionMethod: 'VISUAL' },
      });
    const abortion = (abortionDate: Date) =>
      prisma.abortionEvent.create({ data: { cattleId, abortionDate } });
    // 7 rows: T2 ×1 heat; T1 ×4 (three heats + one abortion — a cross-table tie); T0 ×2 (heat + abortion).
    await Promise.all([
      heat(T2),
      heat(T1),
      heat(T1),
      heat(T1),
      abortion(T1),
      heat(T0),
      abortion(T0),
    ]);
  }, 30_000);

  afterAll(async () => {
    await prisma.heatEvent.deleteMany({ where: { cattleId } });
    await prisma.abortionEvent.deleteMany({ where: { cattleId } });
    await prisma.cattle.delete({ where: { id: cattleId } });
    await ctx.app.close();
  });

  async function fetchPage(
    query: Record<string, string | number>,
    u: AuthedUser = owner,
  ): Promise<Page> {
    const res = await request(server())
      .get(api('/reproduction/events'))
      .query({ cattleId, ...query })
      .set(...auth(u))
      .expect(200);
    return { items: res.body.data, meta: res.body.meta };
  }

  async function walk(sortOrder: 'asc' | 'desc', limit: number) {
    const pages: Page[] = [];
    let cursor: string | undefined;
    do {
      const page = await fetchPage({
        sortOrder,
        limit,
        ...(cursor ? { cursor } : {}),
      });
      pages.push(page);
      cursor = page.meta.hasNextPage
        ? (page.meta.endCursor ?? undefined)
        : undefined;
    } while (cursor && pages.length < 20);
    return pages;
  }

  /** The documented total order: (date, type, id), flipped for desc. */
  function expectedOrder(rows: Row[], sortOrder: 'asc' | 'desc'): string[] {
    const asc = [...rows].sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime() ||
        (a.event_type < b.event_type
          ? -1
          : a.event_type > b.event_type
            ? 1
            : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    return (sortOrder === 'asc' ? asc : asc.reverse()).map((r) => r.id);
  }

  it('walks every row exactly once in (date, type, id) order — desc, page size 2', async () => {
    const all = (await fetchPage({ limit: 100 })).items;
    expect(all).toHaveLength(7);

    const pages = await walk('desc', 2);
    expect(pages.map((p) => p.items.length)).toEqual([2, 2, 2, 1]);
    expect(pages.map((p) => p.meta.hasNextPage)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const walked = pages.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(walked).size).toBe(7);
    expect(walked).toEqual(expectedOrder(all, 'desc'));
  });

  it('walks ascending too, in the exact reverse order', async () => {
    const all = (await fetchPage({ limit: 100 })).items;
    const pages = await walk('asc', 3);
    const walked = pages.flatMap((p) => p.items.map((i) => i.id));
    expect(walked).toEqual(expectedOrder(all, 'asc'));
    expect(walked).toHaveLength(7);
  });

  it('every page size yields the same full sequence (no dropped / repeated tie rows)', async () => {
    const all = (await fetchPage({ limit: 100 })).items;
    const want = expectedOrder(all, 'desc');
    for (const limit of [1, 2, 3, 4, 6, 7, 8]) {
      const walked = (await walk('desc', limit)).flatMap((p) =>
        p.items.map((i) => i.id),
      );
      expect(walked).toEqual(want);
    }
  });

  it('honours eventType + date filters while paging', async () => {
    const heatOnly = await fetchPage({ eventType: 'heat', limit: 2 });
    expect(heatOnly.items.every((i) => i.event_type === 'heat')).toBe(true);
    expect(heatOnly.meta.hasNextPage).toBe(true); // 5 heats, 2 per page

    const windowed = await fetchPage({
      limit: 100,
      fromDate: T1.toISOString(),
      toDate: T2.toISOString(),
    });
    expect(windowed.items).toHaveLength(5); // T2 ×1 + T1 ×4
  });

  it('rejects a malformed cursor with 400, and a worker (heat-only RBAC) still gets 403', async () => {
    await request(server())
      .get(api('/reproduction/events'))
      .query({ cattleId, cursor: 'not-a-cursor' })
      .set(...auth(owner))
      .expect(400);
    await request(server())
      .get(api('/reproduction/events'))
      .query({ cattleId, limit: 2 })
      .set(...auth(worker))
      .expect(403);
  });
});
