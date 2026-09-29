import { BadRequestException } from '@nestjs/common';
import { LactationStatus, MilkDisposition, MilkTankType } from '@prisma/client';
import { ReportGeneratorsService } from './report-generators.service';

/**
 * RAKHAL-288 — Individual Lactation Report + Herd Lactation Dashboard.
 * Mocked-Prisma + FarmSettingsService direct-instantiation pattern (matches
 * `lactation-stats.service.spec.ts`'s precedent) since `ReportGeneratorsService`
 * has no side effects to verify via a real Nest TestingModule. Kept in a
 * dedicated spec file (rather than growing the untested rest of
 * `report-generators.service.ts`) so this ticket's new coverage is easy to
 * find; the other 19 report generators in that file predate written unit
 * tests (their own DoD only ever asked for `nest build`+`eslint`+`jest`).
 */
describe('ReportGeneratorsService — lactation reports (RAKHAL-288)', () => {
  let prisma: {
    lactation: { findFirst: jest.Mock; findMany: jest.Mock };
    milkLogEntry: { findMany: jest.Mock; aggregate: jest.Mock };
    milkQualityTest: { findMany: jest.Mock };
    healthCase: { findMany: jest.Mock };
    breedingEvent: { findMany: jest.Mock };
    pregnancy: { findMany: jest.Mock };
    dryPeriod: { findFirst: jest.Mock };
  };
  let farmSettings: { lactationStageThresholds: jest.Mock };

  const activeLactationRow = {
    id: 'lact-1',
    cattleId: 'cattle-1',
    lactationNumber: 2,
    isEstimated: false,
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: null,
    status: LactationStatus.ACTIVE,
    endReason: null,
    peakMilkYield: 20,
    peakMilkDate: new Date('2026-06-10T00:00:00.000Z'),
    peakDaysInMilk: 9,
    cattle: {
      tagNumber: 'T-001',
      name: 'Bessie',
      shed: { name: 'Shed A' },
    },
  };

  beforeEach(() => {
    prisma = {
      lactation: {
        findFirst: jest.fn().mockResolvedValue(activeLactationRow),
        findMany: jest.fn().mockResolvedValue([]),
      },
      milkLogEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { yieldL: null } }),
      },
      milkQualityTest: { findMany: jest.fn().mockResolvedValue([]) },
      healthCase: { findMany: jest.fn().mockResolvedValue([]) },
      breedingEvent: { findMany: jest.fn().mockResolvedValue([]) },
      pregnancy: { findMany: jest.fn().mockResolvedValue([]) },
      dryPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
      farm: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Dhaka' }),
      },
    };
    farmSettings = {
      lactationStageThresholds: jest
        .fn()
        .mockResolvedValue({ freshDays: 21, earlyDays: 100, midDays: 200 }),
    };
  });

  const make = () =>
    new ReportGeneratorsService(prisma as never, farmSettings as never);

  describe('rpt_lactation_individual', () => {
    it('throws when neither cattleId nor lactationId is supplied', async () => {
      const service = make();
      await expect(
        service.generate('farm-1', 'rpt_lactation_individual', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the resolved cattleId has no lactation at all', async () => {
      prisma.lactation.findFirst.mockResolvedValue(null);
      const service = make();
      await expect(
        service.generate('farm-1', 'rpt_lactation_individual', {
          cattleId: 'cattle-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves lactationId directly when supplied', async () => {
      const service = make();
      await service.generate('farm-1', 'rpt_lactation_individual', {
        lactationId: 'lact-1',
      });
      expect(prisma.lactation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lact-1', cattle: { farmId: 'farm-1' } },
        }),
      );
    });

    it('falls back to the most recently ended lactation when the cow has no ACTIVE one', async () => {
      const endedRow = {
        ...activeLactationRow,
        id: 'lact-0',
        status: LactationStatus.ENDED,
        endDate: new Date('2026-05-01T00:00:00.000Z'),
        endReason: 'DRY_OFF',
      };
      prisma.lactation.findFirst
        .mockResolvedValueOnce(null) // no ACTIVE lactation
        .mockResolvedValueOnce(endedRow); // fallback to most-recently-ended
      const service = make();

      const data = await service.generate(
        'farm-1',
        'rpt_lactation_individual',
        { cattleId: 'cattle-1' },
      );

      expect(prisma.lactation.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            cattleId: 'cattle-1',
            cattle: { farmId: 'farm-1' },
            endDate: { not: null },
          },
          orderBy: { endDate: 'desc' },
        }),
      );
      expect(data.title).toContain('T-001');
    });

    it('returns dates/DIM/totals/peak/persistency/quality/health/breeding/dry-off sections', async () => {
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        {
          logDate: new Date('2026-06-05T00:00:00.000Z'),
          yieldL: 15,
          disposition: MilkDisposition.SALEABLE,
        },
        {
          logDate: new Date('2026-06-06T00:00:00.000Z'),
          yieldL: 3,
          disposition: MilkDisposition.WITHHELD,
        },
      ]);
      prisma.milkQualityTest.findMany.mockResolvedValueOnce([
        {
          sampleDate: new Date('2026-06-05T00:00:00.000Z'),
          fatPct: 4.1,
          proteinPct: 3.3,
          lactosePct: null,
          somaticCellCount: null,
          milkUreaNitrogen: null,
          source: 'LAB',
        },
      ]);
      prisma.healthCase.findMany.mockResolvedValueOnce([
        {
          note: 'Mastitis',
          priority: 'HIGH',
          status: 'RECOVERED',
          startDate: new Date('2026-06-03T00:00:00.000Z'),
          closedDate: new Date('2026-06-08T00:00:00.000Z'),
        },
      ]);
      prisma.breedingEvent.findMany.mockResolvedValueOnce([
        {
          breedingDate: new Date('2026-06-20T00:00:00.000Z'),
          breedingMethod: 'AI',
          breedingNumber: 1,
          status: 'PENDING_CHECK',
        },
      ]);

      const service = make();
      const data = await service.generate(
        'farm-1',
        'rpt_lactation_individual',
        { cattleId: 'cattle-1' },
      );

      expect(data.sections).toBeDefined();
      const headings = data.sections?.map((s) => s.heading);
      expect(headings).toEqual([
        'Overview',
        'Totals & Yield',
        'Peak & Persistency',
        'Milk Quality Tests',
        'Health Incidents',
        'Breeding Timeline',
        'Dry-off',
      ]);

      const overview = data.sections!.find((s) => s.heading === 'Overview')!;
      expect(overview.rows).toEqual(
        expect.arrayContaining([
          ['Shed', 'Shed A'],
          ['Lactation number', 2],
        ]),
      );

      const totals = data.sections!.find(
        (s) => s.heading === 'Totals & Yield',
      )!;
      expect(totals.rows).toEqual(
        expect.arrayContaining([
          ['Produced to date (L)', 18],
          ['Saleable (L)', 15],
          ['Withheld (L)', 3],
        ]),
      );

      const peak = data.sections!.find(
        (s) => s.heading === 'Peak & Persistency',
      )!;
      expect(peak.rows[0]).toEqual(['Peak yield (L)', 20]);

      const quality = data.sections!.find(
        (s) => s.heading === 'Milk Quality Tests',
      )!;
      expect(quality.rows).toHaveLength(1);

      const health = data.sections!.find(
        (s) => s.heading === 'Health Incidents',
      )!;
      expect(health.rows[0][0]).toBe('Mastitis');

      const breeding = data.sections!.find(
        (s) => s.heading === 'Breeding Timeline',
      )!;
      expect(breeding.rows).toHaveLength(1);

      const dryOff = data.sections!.find((s) => s.heading === 'Dry-off')!;
      expect(dryOff.rows[0]).toEqual(['Status', 'Still lactating']);
    });

    it('surfaces endReason and the DryPeriod record for an ended lactation', async () => {
      const endedRow = {
        ...activeLactationRow,
        id: 'lact-0',
        status: LactationStatus.ENDED,
        endDate: new Date('2026-07-01T00:00:00.000Z'),
        endReason: 'DRY_OFF',
      };
      prisma.lactation.findFirst.mockResolvedValueOnce(endedRow);
      prisma.dryPeriod.findFirst.mockResolvedValueOnce({
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        actualEndDate: null,
        reason: 'SCHEDULED',
        notes: 'Dry-cow antibiotic tube administered',
      });

      const service = make();
      const data = await service.generate(
        'farm-1',
        'rpt_lactation_individual',
        { lactationId: 'lact-0' },
      );

      const dryOff = data.sections!.find((s) => s.heading === 'Dry-off')!;
      expect(dryOff.rows).toEqual(
        expect.arrayContaining([
          ['End reason', 'DRY_OFF'],
          ['Dry-off reason (recorded)', 'SCHEDULED'],
          ['Notes / dry-cow treatment', 'Dry-cow antibiotic tube administered'],
        ]),
      );
    });
  });

  describe('rpt_lactation_herd_dashboard', () => {
    it('returns zeroed summary when no cow is currently milking', async () => {
      prisma.lactation.findMany.mockResolvedValueOnce([]);
      const service = make();

      const data = await service.generate(
        'farm-1',
        'rpt_lactation_herd_dashboard',
        {},
      );

      expect(data.summary).toEqual(
        expect.arrayContaining([
          { label: 'Currently milking', value: 0 },
          { label: 'Avg milk/cow/day (L)', value: 0 },
          { label: 'Avg DIM', value: 0 },
          { label: 'Highest producer', value: 'N/A' },
          { label: 'Milk withheld today (L)', value: 0 },
        ]),
      );
      expect(data.rows).toEqual([]);
    });

    it('buckets currently-milking cows by stage and finds the highest producer', async () => {
      const now = new Date();
      const freshStart = new Date(now);
      freshStart.setUTCDate(freshStart.getUTCDate() - 5); // FRESH (< 21 days)
      const lateStart = new Date(now);
      lateStart.setUTCDate(lateStart.getUTCDate() - 250); // LATE (> 200 days)

      prisma.lactation.findMany.mockResolvedValueOnce([
        {
          cattleId: 'cattle-fresh',
          startDate: freshStart,
          cattle: { tagNumber: 'T-FRESH', name: 'Fresh Cow' },
        },
        {
          cattleId: 'cattle-late',
          startDate: lateStart,
          cattle: { tagNumber: 'T-LATE', name: 'Late Cow' },
        },
      ]);
      prisma.milkLogEntry.findMany.mockResolvedValueOnce([
        { cattleId: 'cattle-fresh', yieldL: 12 },
        { cattleId: 'cattle-late', yieldL: 30 },
      ]);
      prisma.milkLogEntry.aggregate.mockResolvedValueOnce({
        _sum: { yieldL: 5 },
      });

      const service = make();
      const data = await service.generate(
        'farm-1',
        'rpt_lactation_herd_dashboard',
        {},
      );

      expect(data.rows).toEqual(
        expect.arrayContaining([
          ['FRESH', 1],
          ['LATE', 1],
        ]),
      );
      expect(data.summary).toEqual(
        expect.arrayContaining([
          { label: 'Currently milking', value: 2 },
          { label: 'Avg milk/cow/day (L)', value: 21 },
          { label: 'Milk withheld today (L)', value: 5 },
        ]),
      );
      const highestProducer = data.summary!.find(
        (s) => s.label === 'Highest producer',
      )!;
      expect(String(highestProducer.value)).toContain('T-LATE');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- jest.Mock's `.calls` is inherently `any[][]`
      const aggregateCall = prisma.milkLogEntry.aggregate.mock.calls[0][0] as {
        where: { farmId: string; tankType: string };
      };
      expect(aggregateCall.where.farmId).toBe('farm-1');
      expect(aggregateCall.where.tankType).toBe(MilkTankType.WITHHOLDING);
    });
  });
});
