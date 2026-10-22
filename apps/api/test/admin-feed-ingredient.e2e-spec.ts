import request from 'supertest';
import { purgeAdminAudit } from './utils/admin-audit';
import * as argon2 from 'argon2';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AdminTotpService } from '../src/modules/admin/application/services/admin-totp.service';

/**
 * Admin Feed Ingredient Master (RAKHAL-233, PRD §35.11 ADM-13/14 — user request 2026-07-17). CRUD
 * over the **global** ingredient catalogue (`farmId: null`) behind `PlatformAdminGuard` — a farm
 * token can't reach it, and the admin routes only ever touch catalogue rows (never a farm's own
 * quick-add/promoted ingredient). Confirms a created/updated catalogue ingredient is immediately
 * visible read-only to farms via the existing `GET /feed/ingredients`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Admin Feed Ingredient Master (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let adminToken: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const adminAuth = (): [string, string] => [
    'Authorization',
    `Bearer ${adminToken}`,
  ];
  const farmAuth = (): [string, string] => [
    'Authorization',
    `Bearer ${owner.token}`,
  ];

  let prisma: PrismaService;
  let throwawayAdminId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    // RD-078: this suite used to share the seeded `admin@rakhal.test` row
    // with the other two admin e2e suites, which intermittently 401'd mid-run
    // when all three run in parallel (root cause not nailed down — plausibly
    // TOTP-window drift across concurrent logins against the same secret at
    // the same 30s step, since the failures traced to the *login* verify
    // path, not to the admin row's `isActive` flag). A dedicated throwaway
    // admin with its own random TOTP secret removes the shared state
    // entirely, regardless of the exact mechanism — same pattern
    // `admin.e2e-spec.ts` already uses for its own throwaway admins.
    const totpSecret = new AdminTotpService().generateSecret();
    const throwaway = await prisma.platformAdmin.create({
      data: {
        email: `feed-ingredient-e2e-${Date.now()}@rakhal.test`,
        name: 'RD-078 Feed Ingredient E2E Admin',
        passwordHash: await argon2.hash('FeedIngredientE2E123', {
          type: argon2.argon2id,
        }),
        role: 'SUPER_ADMIN',
        totpSecret,
        totpEnabled: true,
      },
    });
    throwawayAdminId = throwaway.id;

    const login = await request(server())
      .post(api('/admin/auth/login'))
      .send({
        email: throwaway.email,
        password: 'FeedIngredientE2E123',
        code: currentTotpCode(totpSecret),
      })
      .expect(201);
    adminToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;
  }, 30_000);

  afterAll(async () => {
    // The audit rows this admin wrote reference it (FK); clear them first.
    await purgeAdminAudit(prisma, throwawayAdminId);
    await prisma.platformAdmin.delete({ where: { id: throwawayAdminId } });
    await ctx.app.close();
  });

  it('a farm token cannot reach the admin ingredient routes', async () => {
    await request(server())
      .get(api('/admin/feed-ingredients'))
      .set(...farmAuth())
      .expect(401);
  });

  it('creates a global catalogue ingredient, visible read-only to farms', async () => {
    const name = `E2E Admin Catalogue Ingredient ${Date.now()}`;
    const created = await request(server())
      .post(api('/admin/feed-ingredients'))
      .set(...adminAuth())
      .send({
        nameEn: name,
        feedClass: 'CONCENTRATE',
        dmPct: 88,
        cpPct: 44,
        meMjPerKgDm: 13.5,
        fatPct: 1.5,
        ndfPct: 10,
        rdpPct: 35,
        rupPct: 65,
        currentPricePerKg: 51,
      })
      .expect(201);

    const ing = created.body.data;
    expect(ing.name_en).toBe(name);
    expect(ing.is_custom).toBe(false); // farmId: null — a real catalogue row, not farm-owned
    expect(ing.nutrition.cp_pct).toBe(44);
    expect(ing.nutrition.rdp_pct).toBe(35);

    const farmList = await request(server())
      .get(api('/feed/ingredients'))
      .set(...farmAuth())
      .expect(200);
    expect(
      (farmList.body.data as Array<{ id: string }>).some(
        (i) => i.id === ing.id,
      ),
    ).toBe(true);
  });

  it('updates a catalogue ingredient — price change is immediately visible to farms', async () => {
    const created = await request(server())
      .post(api('/admin/feed-ingredients'))
      .set(...adminAuth())
      .send({
        nameEn: `E2E Admin Price Update ${Date.now()}`,
        feedClass: 'FORAGE',
        feedSubType: 'ROUGHAGE',
        dmPct: 20,
        cpPct: 10,
        meMjPerKgDm: 9,
        currentPricePerKg: 6,
      })
      .expect(201);
    const id = created.body.data.id as string;

    const updated = await request(server())
      .patch(api(`/admin/feed-ingredients/${id}`))
      .set(...adminAuth())
      .send({ currentPricePerKg: 9, cpPct: 12 })
      .expect(200);
    expect(updated.body.data.nutrition.cp_pct).toBe(12);

    const farmList = await request(server())
      .get(api('/feed/ingredients'))
      .set(...farmAuth())
      .expect(200);
    const farmView = (
      farmList.body.data as Array<{
        id: string;
        effective_price_per_kg: number;
      }>
    ).find((i) => i.id === id);
    expect(farmView?.effective_price_per_kg).toBe(9);
  });

  it('rejects updating a farm-owned (non-catalogue) ingredient via the admin route', async () => {
    const custom = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...farmAuth())
      .send({
        name: `E2E Farm-Owned ${Date.now()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 5,
      })
      .expect(201);

    await request(server())
      .patch(api(`/admin/feed-ingredients/${custom.body.data.id}`))
      .set(...adminAuth())
      .send({ cpPct: 50 })
      .expect(400);
  });

  it('archives then restores a catalogue ingredient', async () => {
    const created = await request(server())
      .post(api('/admin/feed-ingredients'))
      .set(...adminAuth())
      .send({
        nameEn: `E2E Admin Archive ${Date.now()}`,
        feedClass: 'ADDITIVE',
        feedSubType: 'SUPPLEMENT',
        dmPct: 90,
        cpPct: 20,
        meMjPerKgDm: 10,
        currentPricePerKg: 15,
      })
      .expect(201);
    const id = created.body.data.id as string;

    await request(server())
      .delete(api(`/admin/feed-ingredients/${id}`))
      .set(...adminAuth())
      .expect(200);

    const listAfterArchive = await request(server())
      .get(api('/feed/ingredients'))
      .set(...farmAuth())
      .expect(200);
    expect(
      (listAfterArchive.body.data as Array<{ id: string }>).some(
        (i) => i.id === id,
      ),
    ).toBe(false);

    await request(server())
      .post(api(`/admin/feed-ingredients/${id}/restore`))
      .set(...adminAuth())
      .expect(201);

    const listAfterRestore = await request(server())
      .get(api('/feed/ingredients'))
      .set(...farmAuth())
      .expect(200);
    expect(
      (listAfterRestore.body.data as Array<{ id: string }>).some(
        (i) => i.id === id,
      ),
    ).toBe(true);
  });
});
