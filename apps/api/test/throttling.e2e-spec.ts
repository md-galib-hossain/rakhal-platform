import request from 'supertest';
import type { App } from 'supertest/types';
import { REDIS_CLIENT } from '../src/core/redis/redis.constants';
import type { RedisClient } from '../src/core/redis/redis.module';
import {
  AuthedUser,
  TestContext,
  bearer,
  createTestApp,
  loginAs,
} from './utils/e2e';

/**
 * RAKHAL-111 — rate limiting is now global (`APP_GUARD`), Redis-backed, and
 * keyed per authenticated user.
 *
 * This is the one suite that opts *in* to throttling (`{ throttling: true }`);
 * every other spec keeps the guard stubbed out or it would trip the 5/min auth
 * tier during its own setup.
 *
 * Two users are logged in before Redis is flushed so that login itself does
 * not consume the budgets under test.
 */
describe('Rate limiting (RAKHAL-111)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let redis: RedisClient;
  let server: App;

  beforeAll(async () => {
    ctx = await createTestApp({ throttling: true });
    server = ctx.app.getHttpServer() as App;
    redis = ctx.app.get<RedisClient>(REDIS_CLIENT);

    // Clear first: `loginAs` spends two requests per user against the 5/min
    // `@ThrottleAuth()` tier, and that tier carries a 15-minute blockDuration —
    // leftovers from a previous run would lock this suite out before it starts.
    await flushThrottleKeys();

    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
  });

  afterAll(async () => {
    await flushThrottleKeys();
    await ctx.app.close();
  });

  beforeEach(async () => {
    await flushThrottleKeys();
  });

  /** node-redis v5's scanIterator yields *batches*, and DEL rejects an empty one. */
  async function flushThrottleKeys() {
    for (const key of await scanThrottleKeys()) {
      await redis.del(key);
    }
  }

  async function scanThrottleKeys(): Promise<string[]> {
    const found: string[] = [];
    for await (const batch of redis.scanIterator({ MATCH: 'throttle:*' })) {
      found.push(...(Array.isArray(batch) ? batch : [batch]));
    }
    return found;
  }

  /** `@ThrottleExpensive()` = 10/min. Fire 11 and keep every status. */
  async function hammerReports(token: string, times: number) {
    const codes: number[] = [];
    for (let i = 0; i < times; i++) {
      const res = await request(server)
        .post(`${ctx.prefix}/reports/generate`)
        .set(bearer(token))
        .send({ reportId: 'rpt_cattle_inventory', format: 'CSV' });
      codes.push(res.status);
    }
    return codes;
  }

  it('429s past the tier limit and says RATE_LIMITED, not INTERNAL_ERROR', async () => {
    const codes = await hammerReports(owner.token, 11);

    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(codes[0]).not.toBe(429);

    // The rejected request must be self-describing: before this ticket the
    // filter had no 429 row and returned code INTERNAL_ERROR alongside a 429.
    const blocked = await request(server)
      .post(`${ctx.prefix}/reports/generate`)
      .set(bearer(owner.token))
      .send({ reportId: 'rpt_cattle_inventory', format: 'CSV' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('buckets per user, not per IP (both users share 127.0.0.1 here)', async () => {
    await hammerReports(owner.token, 11);

    // Same source address, different token — must still be served. This is the
    // carrier-grade-NAT case: one abusive account must not lock out everyone
    // sharing its egress IP.
    const other = await request(server)
      .post(`${ctx.prefix}/reports/generate`)
      .set(bearer(manager.token))
      .send({ reportId: 'rpt_cattle_inventory', format: 'CSV' });

    expect(other.status).not.toBe(429);
  });

  it('does not mint a fresh bucket for an unverifiable token', async () => {
    const forged = 'Bearer a.b.c';

    // A forged/garbage token must fall back to the IP bucket. If getTracker
    // decoded instead of verified, each distinct fake `sub` would get its own
    // budget and the limiter would be bypassable outright.
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(server)
        .post(`${ctx.prefix}/reports/generate`)
        .set('Authorization', forged)
        .send({ reportId: 'rpt_cattle_inventory', format: 'CSV' });
      codes.push(res.status);
    }

    // Unauthenticated, so 401 is the expected happy path — the assertion is
    // that the throttler eventually takes over rather than letting all 12 pass.
    expect(codes.some((c) => c === 429)).toBe(true);
  });

  it('leaves /live unthrottled so a restart signal can never be locked out', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await request(server).get('/live');
      codes.push(res.status);
    }
    expect(codes.every((c) => c === 200)).toBe(true);
  });

  it('stores counters in Redis, not in process memory', async () => {
    await hammerReports(owner.token, 3);

    const keys = await scanThrottleKeys();

    // Proves the PM2-cluster property: with the package's default in-memory
    // storage this array is empty and every worker would count separately.
    expect(keys.length).toBeGreaterThan(0);
  });
});
