import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-454 — `GET /feed/requirements?cattleIds=a,b,c`: batched per-cow requirement + data-quality
 * flags. Requires the dev stack up + `pnpm seed`.
 */
describe('Feed requirements — batched per-cow (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let weighed: string;
  let unweighed: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (l: string) => `E2E-454-${l}-${Date.now()}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');

    const a = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('W'), gender: 'FEMALE', weightKg: 420 })
      .expect(201);
    weighed = a.body.data.id as string;
    const b = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({ tagNumber: tag('U'), gender: 'FEMALE' })
      .expect(201);
    unweighed = b.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns one requirement + flags per cow and reports unknown ids', async () => {
    const res = await request(server())
      .get(api(`/feed/requirements?cattleIds=${weighed},${unweighed},ghost-id`))
      .set(...auth(owner))
      .expect(200);
    const data = res.body.data as {
      cows: Array<{
        cattle_id: string;
        flags: string[];
        inputs: { weight_kg: number; animal_type: string };
        requirements: { dm_kg: number };
      }>;
      missing_cattle_ids: string[];
    };
    expect(data.cows).toHaveLength(2);
    expect(data.missing_cattle_ids).toEqual(['ghost-id']);

    const w = data.cows.find((c) => c.cattle_id === weighed)!;
    expect(w.inputs.weight_kg).toBe(420);
    expect(w.inputs.animal_type).toBe('HEIFER');
    expect(w.requirements.dm_kg).toBeGreaterThan(0);

    const u = data.cows.find((c) => c.cattle_id === unweighed)!;
    expect(u.flags).toEqual(expect.arrayContaining(['weight_estimated']));
    expect(u.inputs.weight_kg).toBe(450);
  });

  it('needs no manual weight/milk in batch mode (no 400)', async () => {
    await request(server())
      .get(api(`/feed/requirements?cattleIds=${weighed}`))
      .set(...auth(owner))
      .expect(200);
  });

  it('rejects a malformed date', async () => {
    await request(server())
      .get(api(`/feed/requirements?cattleIds=${weighed}&date=yesterday`))
      .set(...auth(owner))
      .expect(400);
  });

  it('lets a worker read it (feed.read)', async () => {
    await request(server())
      .get(api(`/feed/requirements?cattleIds=${weighed}`))
      .set(...auth(worker))
      .expect(200);
  });
});
