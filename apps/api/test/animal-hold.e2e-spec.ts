import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-280 — generic AnimalHold mechanism. `/cattle/:cattleId/holds`
 * create/list/release, RBAC (`cattle.hold`, manager+ only — workers only get
 * `cattle.read`/`cattle.bcs` per `ROLE_PERMISSIONS`), and multi-tenant
 * isolation. Not yet consumed by reproduction/milk (RAKHAL-272/278, later
 * tickets) — this only exercises the mechanism itself.
 *
 * NOTE: requires the `20260805140000_rakhal_280_animal_hold` migration to be
 * applied (`prisma migrate deploy`) against the dev DB before it can run —
 * per this ticket's instructions, the migration was written but NOT applied
 * here (shared dev DB, one migration at a time across agents). Requires the
 * dev stack up + `pnpm seed`.
 */
describe('Cattle — AnimalHold (RAKHAL-280)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let cattleId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'DemoPass123');

    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });

    const cow = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RAKHAL280-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUser.id,
      },
    });
    cattleId = cow.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('owner creates a hold', async () => {
    const res = await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...auth(owner))
      .send({ type: 'REPRODUCTIVE', reason: 'awaiting vet confirmation' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('REPRODUCTIVE');
    expect(res.body.data.reason).toBe('awaiting vet confirmation');
    expect(res.body.data.endedAt).toBeNull();
    expect(res.body.data.farmId).toBe(owner.farmId);
    expect(res.body.data.cattleId).toBe(cattleId);
  });

  it('rejects an invalid hold type', async () => {
    const res = await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...auth(owner))
      .send({ type: 'NOT_A_TYPE', reason: 'bad payload' });

    expect(res.status).toBe(400);
  });

  it('404s creating a hold on cattle outside the caller farm', async () => {
    const res = await request(server())
      .post(api(`/cattle/does-not-exist/holds`))
      .set(...auth(owner))
      .send({ type: 'OTHER', reason: 'probe' });

    expect(res.status).toBe(404);
  });

  it('worker (read-only cattle RBAC) cannot create a hold', async () => {
    const res = await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...auth(worker))
      .send({ type: 'QUARANTINE', reason: 'RBAC probe' });

    expect(res.status).toBe(403);
  });

  it('manager can create + list + release a hold end to end', async () => {
    const createRes = await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...auth(manager))
      .send({ type: 'MILK_DISCARD', reason: 'antibiotic withdrawal' });
    expect(createRes.status).toBe(201);
    const holdId = createRes.body.data.id as string;

    const listRes = await request(server())
      .get(api(`/cattle/${cattleId}/holds`))
      .set(...auth(manager));
    expect(listRes.status).toBe(200);
    expect(
      (listRes.body.data as Array<{ id: string }>).some((h) => h.id === holdId),
    ).toBe(true);

    const releaseRes = await request(server())
      .patch(api(`/cattle/${cattleId}/holds/${holdId}/release`))
      .set(...auth(manager))
      .send({ note: 'withdrawal window elapsed' });
    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.data.endedAt).not.toBeNull();
    expect(releaseRes.body.data.releasedBy).toBeTruthy();

    // Default list (active-only) no longer includes the released hold.
    const listAfter = await request(server())
      .get(api(`/cattle/${cattleId}/holds`))
      .set(...auth(manager));
    expect(
      (listAfter.body.data as Array<{ id: string }>).some(
        (h) => h.id === holdId,
      ),
    ).toBe(false);

    // includeReleased=true still shows it.
    const listIncluded = await request(server())
      .get(api(`/cattle/${cattleId}/holds?includeReleased=true`))
      .set(...auth(manager));
    expect(
      (listIncluded.body.data as Array<{ id: string }>).some(
        (h) => h.id === holdId,
      ),
    ).toBe(true);
  });

  it('releasing an already-released hold is idempotent (200, no error)', async () => {
    const createRes = await request(server())
      .post(api(`/cattle/${cattleId}/holds`))
      .set(...auth(owner))
      .send({ type: 'OTHER', reason: 'idempotency probe' });
    const holdId = createRes.body.data.id as string;

    const first = await request(server())
      .patch(api(`/cattle/${cattleId}/holds/${holdId}/release`))
      .set(...auth(owner))
      .send({});
    expect(first.status).toBe(200);

    const second = await request(server())
      .patch(api(`/cattle/${cattleId}/holds/${holdId}/release`))
      .set(...auth(owner))
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.data.endedAt).toBe(first.body.data.endedAt);
  });

  it('404s releasing a hold id that does not belong to this cattle', async () => {
    const res = await request(server())
      .patch(api(`/cattle/${cattleId}/holds/does-not-exist/release`))
      .set(...auth(owner))
      .send({});

    expect(res.status).toBe(404);
  });
});
