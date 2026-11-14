import { ActivityLogService } from './activity-log.service';

/**
 * RAKHAL-304 — covers `record`'s new optional `previousAqrScore` field and
 * the append-only hash chain (`verifyChain`) staying valid across a normal
 * event followed by a reversal-shaped entry (the exact sequence
 * `AqrService.applyEvent` + `AqrService.reverseEvent` produce). Uses an
 * in-memory fake for `prisma.activityLog` (`$transaction` just runs the
 * callback against the same fake) since chain integrity is a property of
 * `record`/`verifyChain` themselves, not of any one caller.
 */
describe('ActivityLogService', () => {
  const makeInMemoryPrisma = () => {
    const rows: Array<Record<string, unknown>> = [];
    let seq = 0;
    const prismaDouble = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prismaDouble),
      activityLog: {
        findFirst: ({
          orderBy,
        }: {
          orderBy?: { createdAt: 'asc' | 'desc' };
        } = {}) => {
          if (!rows.length) return Promise.resolve(null);
          const sorted = [...rows].sort((a, b) =>
            orderBy?.createdAt === 'asc'
              ? (a.createdAt as Date).getTime() -
                (b.createdAt as Date).getTime()
              : (b.createdAt as Date).getTime() -
                (a.createdAt as Date).getTime(),
          );
          return Promise.resolve(sorted[0]);
        },
        findMany: () =>
          Promise.resolve(
            [...rows].sort(
              (a, b) =>
                (a.createdAt as Date).getTime() -
                (b.createdAt as Date).getTime(),
            ),
          ),
        create: ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            ...data,
            id: `log-${++seq}`,
            createdAt: new Date(Date.now() + seq),
          };
          rows.push(row);
          return Promise.resolve(row);
        },
      },
    };
    return prismaDouble;
  };

  let prismaDouble: ReturnType<typeof makeInMemoryPrisma>;
  let logger: { setContext: jest.Mock };

  beforeEach(() => {
    prismaDouble = makeInMemoryPrisma();
    logger = { setContext: jest.fn().mockReturnThis() };
  });

  const make = () =>
    new ActivityLogService(prismaDouble as never, logger as never);

  it('accepts previousAqrScore and stores it on the row', async () => {
    const service = make();

    const row = await service.record({
      farmId: 'farm-1',
      module: 'COW_MANAGEMENT',
      eventTitle: 'Animal Registered',
      actionDetails: 'test',
      aqrImpact: 50,
      previousAqrScore: 0,
      relatedCattleId: 'cattle-1',
    });

    expect(
      (row as unknown as { previousAqrScore: number }).previousAqrScore,
    ).toBe(0);
  });

  it('keeps the hash chain valid across an event followed by its reversal', async () => {
    const service = make();

    await service.record({
      farmId: 'farm-1',
      module: 'BREEDING',
      eventTitle: 'Pregnancy Confirmed',
      actionDetails: 'applied',
      aqrImpact: 5,
      previousAqrScore: 60,
      relatedCattleId: 'cattle-1',
    });
    await service.record({
      farmId: 'farm-1',
      module: 'BREEDING',
      eventTitle: 'Reversal: Pregnancy Confirmed',
      actionDetails: 'reversed',
      aqrImpact: -5,
      previousAqrScore: 65,
      relatedCattleId: 'cattle-1',
    });

    const result = await service.verifyChain('farm-1');

    expect(result.valid).toBe(true);
    expect(result.entries).toBe(2);
    expect(result.brokenAt).toBeNull();
  });
});
