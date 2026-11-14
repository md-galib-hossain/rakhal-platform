import request from 'supertest';
import { createTestApp, TestContext } from './utils/e2e';

/**
 * RAKHAL-217 — public subscription-plans catalogue (`customer-api`, PRD §31.1).
 * Verifies the seeded Free/Starter/Pro plans are served, price-ordered, with
 * limits + feature keys, and that the route needs **no auth** (pricing page).
 */
interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  limits: { max_cattle: number | null; max_farm_members: number | null };
  features: string[];
}

describe('Subscription plans (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/v1/plans returns the seeded plans without auth, price-ordered', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/plans`)
      .expect(200);

    const plans = (res.body as { data?: PublicPlan[] }).data ?? [];
    const names = plans.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Free', 'Starter', 'Pro']));

    // Ordered by monthly price ascending → Free first.
    expect(plans[0].name).toBe('Free');

    const free = plans.find((p) => p.name === 'Free');
    expect(free?.monthly_price).toBe(0);
    expect(free?.limits.max_cattle).toBe(20);
    expect(free?.features).toEqual(
      expect.arrayContaining(['cattle.module', 'milk.module']),
    );
    // Free must NOT include gated Pro features.
    expect(free?.features).not.toContain('reports.generate');

    const pro = plans.find((p) => p.name === 'Pro');
    expect(pro?.limits.max_cattle).toBeNull(); // unlimited
    expect(pro?.limits.max_farm_members).toBeNull();
    expect(pro?.features).toEqual(
      expect.arrayContaining(['reports.generate', 'scoreboard.read']),
    );
  });
});
