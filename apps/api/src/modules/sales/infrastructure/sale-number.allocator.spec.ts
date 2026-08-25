import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { SaleNumberAllocator } from './sale-number.allocator';

loadEnv();

/**
 * RAKHAL-339 — proves `SaleNumberAllocator` never hands out a duplicate
 * `saleNumber`, even when many callers race for it concurrently. This is
 * deliberately a **real-database** test, not a mocked one: the property being
 * proven is Postgres row-lock serialization on the `FarmCounter` upsert (the
 * exact V1 race this milestone exists to fix, `finance.service.ts:1014-1023`'s
 * `count()+1`), which a mocked, single-threaded `jest.fn()` cannot exercise —
 * a mock would trivially "pass" no matter how broken the real SQL is.
 *
 * Talks to the same dev-stack Postgres every other test in this repo uses
 * (`DATABASE_URL`, `.env`) via a bare `PrismaClient`, not the NestJS-wired
 * `PrismaService` — this spec has no DI container, and `FarmCounter.scope` is
 * a plain string column (no FK to `Farm`), so a throwaway scope id is enough
 * to isolate this run from any other suite's counter state without needing a
 * real seeded farm.
 */
describe('SaleNumberAllocator (real DB, RAKHAL-339)', () => {
  let prisma: PrismaClient;
  const allocator = new SaleNumberAllocator();

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allocates a strictly increasing, gapless sequence for sequential calls', async () => {
    const farmId = `test-sale-number-seq-${Date.now()}`;

    const first = await prisma.$transaction((tx) =>
      allocator.allocate(tx, farmId),
    );
    const second = await prisma.$transaction((tx) =>
      allocator.allocate(tx, farmId),
    );
    const third = await prisma.$transaction((tx) =>
      allocator.allocate(tx, farmId),
    );

    expect(first).toBe('SALE-000001');
    expect(second).toBe('SALE-000002');
    expect(third).toBe('SALE-000003');
  });

  it('never hands out a duplicate number under real concurrency', async () => {
    const farmId = `test-sale-number-race-${Date.now()}`;
    const concurrentCalls = 25;

    const numbers = await Promise.all(
      Array.from({ length: concurrentCalls }, () =>
        prisma.$transaction((tx) => allocator.allocate(tx, farmId)),
      ),
    );

    expect(numbers).toHaveLength(concurrentCalls);
    expect(new Set(numbers).size).toBe(concurrentCalls);
    // The winning set is exactly 000001..000025 — proves no gaps and no
    // skipped/reused values, not merely "no two calls collided".
    const expected = Array.from(
      { length: concurrentCalls },
      (_, i) => `SALE-${String(i + 1).padStart(6, '0')}`,
    );
    expect([...numbers].sort()).toEqual([...expected].sort());
  });

  it('scopes the sequence per farm — two farms never share a counter', async () => {
    const farmA = `test-sale-number-farm-a-${Date.now()}`;
    const farmB = `test-sale-number-farm-b-${Date.now()}`;

    const [aFirst, bFirst] = await Promise.all([
      prisma.$transaction((tx) => allocator.allocate(tx, farmA)),
      prisma.$transaction((tx) => allocator.allocate(tx, farmB)),
    ]);

    expect(aFirst).toBe('SALE-000001');
    expect(bFirst).toBe('SALE-000001');
  });
});
