import { AnimalUpcomingEventsService } from './animal-upcoming-events.service';

const FARM = 'farm1';
// 2026-10-11 12:00 Asia/Dhaka
const NOW = new Date('2026-10-11T06:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

/** The `where` of the first `findMany` call, typed so assertions stay lint-clean. */
function firstWhere(model: { findMany: jest.Mock }): Record<string, unknown> {
  return (
    model.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
  )[0].where;
}

function build(
  rows: Partial<{
    healthTask: unknown[];
    breedingEvent: unknown[];
    pregnancy: unknown[];
    lactation: unknown[];
    safetyWithdrawal: unknown[];
    task: unknown[];
  }> = {},
) {
  const prisma = {
    healthTask: {
      findMany: jest.fn().mockResolvedValue(rows.healthTask ?? []),
    },
    breedingEvent: {
      findMany: jest.fn().mockResolvedValue(rows.breedingEvent ?? []),
    },
    pregnancy: { findMany: jest.fn().mockResolvedValue(rows.pregnancy ?? []) },
    lactation: { findMany: jest.fn().mockResolvedValue(rows.lactation ?? []) },
    safetyWithdrawal: {
      findMany: jest.fn().mockResolvedValue(rows.safetyWithdrawal ?? []),
    },
    task: { findMany: jest.fn().mockResolvedValue(rows.task ?? []) },
  };
  const clock = { timezone: jest.fn().mockResolvedValue('Asia/Dhaka') };
  const service = new AnimalUpcomingEventsService(
    prisma as never,
    clock as never,
  );
  return { service, prisma, clock };
}

describe('AnimalUpcomingEventsService.forCattle', () => {
  it('runs no query for an empty page', async () => {
    const { service, prisma, clock } = build();
    const out = await service.forCattle(FARM, []);
    expect(out.size).toBe(0);
    expect(clock.timezone).not.toHaveBeenCalled();
    for (const model of Object.values(prisma)) {
      expect(model.findMany).not.toHaveBeenCalled();
    }
  });

  it('issues exactly one read per source however many animals are on the page', async () => {
    const { service, prisma, clock } = build();
    const ids = Array.from({ length: 100 }, (_, i) => `c${i}`);
    await service.forCattle(FARM, ids, { now: NOW });

    expect(clock.timezone).toHaveBeenCalledTimes(1);
    for (const [name, model] of Object.entries(prisma)) {
      expect({ name, calls: model.findMany.mock.calls.length }).toEqual({
        name,
        calls: 1,
      });
    }
  });

  it('returns an empty entry for every requested animal, de-duplicating ids', async () => {
    const { service } = build();
    const out = await service.forCattle(FARM, ['a', 'b', 'a'], { now: NOW });
    expect([...out.keys()].sort()).toEqual(['a', 'b']);
    expect(out.get('a')).toEqual({ events: [], total: 0 });
  });

  it('scopes every source to the farm', async () => {
    const { service, prisma } = build();
    await service.forCattle(FARM, ['c1'], { now: NOW });

    // Sources with their own farmId column.
    for (const model of [
      prisma.healthTask,
      prisma.safetyWithdrawal,
      prisma.task,
    ]) {
      expect(firstWhere(model).farmId).toBe(FARM);
    }
    // Sources without one are scoped through the cattle relation.
    for (const model of [
      prisma.breedingEvent,
      prisma.pregnancy,
      prisma.lactation,
    ]) {
      expect(firstWhere(model).cattle).toEqual({ farmId: FARM });
    }
  });

  it('ignores voided breedings, so a mistaken newer record cannot hide a real pending check', async () => {
    const { service, prisma } = build();
    await service.forCattle(FARM, ['c1'], { now: NOW });
    expect(firstWhere(prisma.breedingEvent).voidedAt).toBeNull();

    const filter = (await service.dueFilterWhere(FARM, 'week', NOW)) as {
      OR: Array<{ breedingEvents?: { some: { voidedAt: unknown } } }>;
    };
    const breeding = filter.OR.find((c) => c.breedingEvents)!;
    expect(breeding.breedingEvents!.some.voidedAt).toBeNull();
  });

  it('maps each source to the right event and orders them per animal', async () => {
    const { service } = build({
      healthTask: [
        {
          id: 'ht1',
          cattleId: 'c1',
          title: 'FMD vaccine',
          dueDateTime: inDays(-1),
          planEnrollmentId: 'pe1',
        },
        {
          id: 'ht2',
          cattleId: 'c1',
          title: 'Antibiotic day 3',
          dueDateTime: inDays(1),
          planEnrollmentId: null,
        },
      ],
      breedingEvent: [
        {
          id: 'be1',
          cattleId: 'c1',
          status: 'PENDING_CHECK',
          expectedPregnancyCheckDate: inDays(2),
        },
      ],
      pregnancy: [
        { id: 'pr1', cattleId: 'c2', expectedCalvingDate: inDays(9) },
      ],
      lactation: [
        {
          id: 'l1',
          cattleId: 'c2',
          plannedDryOffAt: null,
          recommendedDryOffAt: inDays(5),
        },
      ],
      safetyWithdrawal: [
        {
          id: 'w1',
          cattleId: 'c1',
          milkWithdrawalUntil: inDays(1),
          meatWithdrawalUntil: null,
        },
      ],
    });

    const out = await service.forCattle(FARM, ['c1', 'c2'], { now: NOW });

    expect(out.get('c1')!.events.map((e) => [e.kind, e.ref.id])).toEqual([
      ['PREVENTIVE_STEP', 'ht1'], // overdue first
      ['HEALTH_STEP', 'ht2'],
      ['PREGNANCY_CHECK', 'be1'],
      ['WITHDRAWAL_END', 'w1'], // informational last despite being sooner than the check
    ]);
    expect(out.get('c1')!.events[0]).toMatchObject({
      urgency: 'OVERDUE',
      labelKey: 'cattle.upcoming.preventiveStep',
      labelParams: { title: 'FMD vaccine' },
    });
    expect(out.get('c2')!.events.map((e) => e.kind)).toEqual([
      'DRY_OFF',
      'CALVING',
    ]);
  });

  it('prefers the farmer-planned dry-off over the recommended one', async () => {
    const { service } = build({
      lactation: [
        {
          id: 'l1',
          cattleId: 'c1',
          plannedDryOffAt: inDays(3),
          recommendedDryOffAt: inDays(10),
        },
      ],
    });
    const out = await service.forCattle(FARM, ['c1'], { now: NOW });
    expect(out.get('c1')!.events[0].daysUntil).toBe(3);
  });

  it('shows a pregnancy check only while the latest breeding is still pending with a date', async () => {
    const { service } = build({
      breedingEvent: [
        {
          id: 'be-failed',
          cattleId: 'c1',
          status: 'FAILED',
          expectedPregnancyCheckDate: inDays(1),
        },
        {
          id: 'be-undated',
          cattleId: 'c2',
          status: 'PENDING_CHECK',
          expectedPregnancyCheckDate: null,
        },
      ],
    });
    const out = await service.forCattle(FARM, ['c1', 'c2'], { now: NOW });
    expect(out.get('c1')!.total).toBe(0);
    expect(out.get('c2')!.total).toBe(0);
  });

  it('emits both milk and meat withdrawal ends', async () => {
    const { service } = build({
      safetyWithdrawal: [
        {
          id: 'w1',
          cattleId: 'c1',
          milkWithdrawalUntil: inDays(2),
          meatWithdrawalUntil: inDays(6),
        },
      ],
    });
    const out = await service.forCattle(FARM, ['c1'], { now: NOW });
    expect(out.get('c1')!.events.map((e) => e.labelKey)).toEqual([
      'cattle.upcoming.milkWithdrawalEnd',
      'cattle.upcoming.meatWithdrawalEnd',
    ]);
  });

  describe('Task Hub tasks', () => {
    it('attaches a multi-cow task to every requested animal on it, ignoring others', async () => {
      const { service } = build({
        task: [
          {
            id: 't1',
            name: 'Weigh group',
            dueAt: inDays(2),
            relatedCattleId: null,
            sourceEventType: null,
            sourceEventId: null,
            cattles: [
              { cattleId: 'c1' },
              { cattleId: 'c2' },
              { cattleId: 'zz' },
            ],
          },
        ],
      });
      const out = await service.forCattle(FARM, ['c1', 'c2'], { now: NOW });
      expect(out.get('c1')!.events[0]).toMatchObject({
        kind: 'TASK',
        labelParams: { title: 'Weigh group' },
      });
      expect(out.get('c2')!.total).toBe(1);
      expect(out.has('zz')).toBe(false);
    });

    it('does not list the same animal twice when it is both related and in the join table', async () => {
      const { service } = build({
        task: [
          {
            id: 't1',
            name: 'Check',
            dueAt: inDays(2),
            relatedCattleId: 'c1',
            sourceEventType: null,
            sourceEventId: null,
            cattles: [{ cattleId: 'c1' }],
          },
        ],
      });
      const out = await service.forCattle(FARM, ['c1'], { now: NOW });
      expect(out.get('c1')!.total).toBe(1);
    });

    it('drops the system task generated from a pregnancy check already shown that day', async () => {
      const { service } = build({
        breedingEvent: [
          {
            id: 'be1',
            cattleId: 'c1',
            status: 'PENDING_CHECK',
            expectedPregnancyCheckDate: inDays(2),
          },
        ],
        task: [
          {
            id: 't1',
            name: 'Pregnancy check due',
            dueAt: inDays(2),
            relatedCattleId: 'c1',
            sourceEventType: 'BREEDING_EVENT',
            sourceEventId: 'be1',
            cattles: [],
          },
        ],
      });
      const out = await service.forCattle(FARM, ['c1'], { now: NOW });
      expect(out.get('c1')!.events.map((e) => e.kind)).toEqual([
        'PREGNANCY_CHECK',
      ]);
    });
  });

  it('caps the list at limit but still reports the full total', async () => {
    const { service } = build({
      healthTask: Array.from({ length: 5 }, (_, i) => ({
        id: `ht${i}`,
        cattleId: 'c1',
        title: `Step ${i}`,
        dueDateTime: inDays(i),
        planEnrollmentId: null,
      })),
    });
    const out = await service.forCattle(FARM, ['c1'], {
      now: NOW,
      limit: 2,
    });
    expect(out.get('c1')!.events).toHaveLength(2);
    expect(out.get('c1')!.total).toBe(5);
  });

  it('bounds the reads by the farm-day end of the window', async () => {
    const { service, prisma } = build();
    await service.forCattle(FARM, ['c1'], { now: NOW, windowDays: 14 });
    // today 2026-10-11 + 14 = 2026-10-25; the farm day after begins 2026-10-25T18:00:00Z (Dhaka midnight)
    const { lt } = firstWhere(prisma.healthTask).dueDateTime as { lt: Date };
    expect(lt.toISOString()).toBe('2026-10-25T18:00:00.000Z');
  });
});

describe('AnimalUpcomingEventsService.dueFilterWhere', () => {
  type Range = { gte?: Date; lt?: Date };
  type Where = { OR: Array<Record<string, unknown>> };
  const iso = (d?: Date) => d?.toISOString();
  // 2026-10-11 12:00 Dhaka: the farm day runs 2026-10-10T18:00Z -> 2026-10-11T18:00Z
  const TODAY_START = '2026-10-10T18:00:00.000Z';
  const TODAY_END = '2026-10-11T18:00:00.000Z';
  const WEEK_END = '2026-10-18T18:00:00.000Z';

  const healthRange = (where: Where): Range =>
    (where.OR[0] as { healthTasks: { some: { dueDateTime: Range } } })
      .healthTasks.some.dueDateTime;

  it.each([
    ['overdue', undefined, TODAY_START],
    ['today', TODAY_START, TODAY_END],
    ['week', TODAY_START, WEEK_END],
  ] as const)('%s uses the farm-day range', async (filter, gte, lt) => {
    const { service, prisma } = build();
    const where = (await service.dueFilterWhere(
      FARM,
      filter,
      NOW,
    )) as unknown as Where;

    const range = healthRange(where);
    expect([iso(range.gte), iso(range.lt)]).toEqual([gte, lt]);
    // The Task Hub lookup uses the very same range.
    const taskRange = firstWhere(prisma.task).dueAt as Range;
    expect([iso(taskRange.gte), iso(taskRange.lt)]).toEqual([gte, lt]);
  });

  it('covers health steps, pregnancy check, calving and dry-off, and skips withdrawals', async () => {
    const { service } = build();
    const where = (await service.dueFilterWhere(
      FARM,
      'week',
      NOW,
    )) as unknown as Where;
    expect(where.OR.map((c) => Object.keys(c as object)[0])).toEqual([
      'healthTasks',
      'breedingEvents',
      'pregnancies',
      'lactations',
    ]);
  });

  it('adds the animals that have an open Task Hub task in the range, once each', async () => {
    const { service } = build({
      task: [
        { relatedCattleId: 'c1', cattles: [{ cattleId: 'c2' }] },
        { relatedCattleId: null, cattles: [{ cattleId: 'c1' }] },
      ],
    });
    const where = (await service.dueFilterWhere(
      FARM,
      'today',
      NOW,
    )) as unknown as Where;
    expect(where.OR[where.OR.length - 1]).toEqual({
      id: { in: ['c1', 'c2'] },
    });
  });

  it('scopes the Task Hub lookup to the farm and to open tasks', async () => {
    const { service, prisma } = build();
    await service.dueFilterWhere(FARM, 'overdue', NOW);
    const where = firstWhere(prisma.task);
    expect(where.farmId).toBe(FARM);
    expect(where.status).toEqual({
      in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'],
    });
  });
});
