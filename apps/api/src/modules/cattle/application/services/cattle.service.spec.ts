import { BadRequestException } from '@nestjs/common';
import { CattleStatus } from '@prisma/client';
import { CattleService } from './cattle.service';

/**
 * RAKHAL-269/271 (v2 correction) — ProductionStatus trim (MILKING|DRY only) +
 * CULLED, and `Cattle.lactationStartDate` fully removed (lactation start now
 * lives solely on `Lactation.startDate`). Covers the new `updateStatus`
 * validation (an active `Lactation` row required for MILKING, not a
 * `Cattle`-level date field) and the extended `archiveWithReason` (culled +
 * productionStatus nulling on any archive path).
 */
describe('CattleService — RAKHAL-269 production status', () => {
  let prisma: {
    cattle: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    lactation: {
      findFirst: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    reproductionProfile: { findUnique: jest.Mock; create: jest.Mock };
    animalHold: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };
  let farmSettings: { getEffective: jest.Mock };
  let subscriptionAccess: { assertCattleLimit: jest.Mock };
  let derivation: { refreshDerivedState: jest.Mock };

  const baseRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'cattle-1',
    farmId: 'farm-1',
    productionStatus: null,
    profilePhotoAssetId: null,
    reproductionProfile: null,
    healthCases: [],
    safetyWithdrawals: [],
    lactations: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      cattle: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      lactation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      reproductionProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      animalHold: { findMany: jest.fn().mockResolvedValue([]) },
      // Both the array form (`$transaction([...])`) and the callback form
      // (`$transaction(async (tx) => ...)`) are used elsewhere in this
      // service — the mock `tx` is just `prisma` itself, since every mocked
      // model method is already directly on this object.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    subscriptionAccess = {
      assertCattleLimit: jest.fn().mockResolvedValue(undefined),
    };
    // RAKHAL-279: `updateStatus`/`archiveWithReason` end by calling
    // `findOne()`, which now builds a `ReproductionContext` via
    // `buildReproductionContext()` — needs a `FarmModuleSettings`-shaped stub
    // even though none of these paths exercise reproduction enrichment
    // (all test rows are `reproductionProfile: null`).
    farmSettings = {
      getEffective: jest.fn().mockResolvedValue({
        reproHeatWindowDays: 3,
        reproCloseUpWindowDays: 21,
        reproOverduePregnancyCheckDays: 7,
        reproCalvingOverdueDays: 7,
        reproRepeatBreederThreshold: 3,
        reproLongDaysOpenDays: 120,
        lactationFreshDays: 21,
        lactationEarlyDays: 100,
        lactationMidDays: 200,
        pregnancyEarlyDays: 90,
        pregnancyMidDays: 180,
      }),
    };
    // RAKHAL-307: `create()`/`update()` now end certain paths with
    // `refreshDerivedState()` — a no-op stub here, its own behavior is
    // covered by `reproduction-derivation.service.spec.ts`.
    derivation = {
      refreshDerivedState: jest.fn().mockResolvedValue(undefined),
    };
  });

  const make = () =>
    new CattleService(
      prisma as never,
      { applyEvent: jest.fn().mockResolvedValue({ aqrScore: 0 }) } as never, // AqrService
      subscriptionAccess as never, // SubscriptionAccessService
      { presentUrls: jest.fn(), signThumbs: jest.fn() } as never, // MediaService
      farmSettings as never, // FarmSettingsService (RAKHAL-279)
      derivation as never, // ReproductionDerivationService (RAKHAL-307)
      logger as never,
    );

  /** Last `data` payload passed to `prisma.cattle.update`, explicitly typed
   * to avoid `expect.objectContaining`'s untyped return tripping
   * `no-unsafe-assignment` under this project's strict lint config. */
  const lastUpdateData = (): Record<string, unknown> => {
    const calls = prisma.cattle.update.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    return calls[calls.length - 1][0].data;
  };

  describe('updateStatus', () => {
    it('rejects setting productionStatus=MILKING with no active Lactation row', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce({
        totalCalvings: 1,
      });

      const service = make();
      await expect(
        service.updateStatus('farm-1', 'cattle-1', {
          productionStatus: 'MILKING',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.cattle.update).not.toHaveBeenCalled();
    });

    it('allows MILKING when an active Lactation row already exists', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow()) // getCattleOrThrow guard check
        .mockResolvedValueOnce(baseRow({ productionStatus: 'MILKING' })); // findOne() at the end of updateStatus
      prisma.lactation.findFirst.mockResolvedValueOnce({ id: 'lactation-1' });
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce({
        totalCalvings: 1,
      });
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'MILKING',
      });

      expect(lastUpdateData()).toMatchObject({ productionStatus: 'MILKING' });
    });

    it('creates a purchase-intake Lactation (startReason PURCHASED_LACTATING) when lactationStartDate + priorCalvings are supplied and no active Lactation exists', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow()) // getCattleOrThrow guard check
        .mockResolvedValueOnce(baseRow({ productionStatus: 'MILKING' })); // findOne() at the end of updateStatus
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce(null);
      prisma.lactation.count.mockResolvedValueOnce(0);
      prisma.lactation.create.mockResolvedValueOnce({ id: 'lactation-new' });
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'MILKING',
        lactationStartDate: '2026-08-01',
        priorCalvings: 2,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.lactation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cattleId: 'cattle-1',
          lactationNumber: 1,
          status: 'ACTIVE',
          startReason: 'PURCHASED_LACTATING',
        }) as unknown,
      });
      expect(prisma.reproductionProfile.create).toHaveBeenCalledWith({
        data: { cattleId: 'cattle-1', totalCalvings: 2 },
      });
      expect(lastUpdateData()).toMatchObject({ productionStatus: 'MILKING' });
    });

    it('allows DRY without checking for an active Lactation row', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow())
        .mockResolvedValueOnce(baseRow({ productionStatus: 'DRY' }));
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'DRY',
      });

      expect(prisma.lactation.findFirst).not.toHaveBeenCalled();
      expect(lastUpdateData()).toMatchObject({ productionStatus: 'DRY' });
    });
  });

  describe('archiveWithReason', () => {
    it('reason=culled sets CattleStatus.CULLED and nulls productionStatus', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.cattle.update.mockResolvedValueOnce(
        baseRow({ status: CattleStatus.CULLED, isActive: false }),
      );

      const service = make();
      await service.archiveWithReason('farm-1', 'cattle-1', {
        reason: 'culled',
      });

      expect(lastUpdateData()).toMatchObject({
        isActive: false,
        productionStatus: null,
        status: CattleStatus.CULLED,
      });
    });

    it('a plain archive (no reason) also nulls productionStatus', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(
        baseRow({ productionStatus: 'MILKING' }),
      );
      prisma.cattle.update.mockResolvedValueOnce(
        baseRow({ status: CattleStatus.ARCHIVED, isActive: false }),
      );

      const service = make();
      await service.archiveWithReason('farm-1', 'cattle-1', {});

      expect(lastUpdateData()).toMatchObject({
        isActive: false,
        productionStatus: null,
        status: CattleStatus.ARCHIVED,
      });
    });

    // RAKHAL-290: sold/deceased/culled are real lifecycle exits — any ACTIVE
    // Lactation must auto-close with the matching LactationEndReason, in the
    // same $transaction as the status flip.
    it.each([
      ['sold', 'SOLD'],
      ['deceased', 'DEATH'],
      ['culled', 'CULLED'],
    ])(
      'reason=%s auto-closes an ACTIVE Lactation with endReason=%s',
      async (reason, endReason) => {
        prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
        prisma.cattle.update.mockResolvedValueOnce(
          baseRow({ isActive: false }),
        );

        const service = make();
        await service.archiveWithReason('farm-1', 'cattle-1', {
          reason: reason as 'sold' | 'deceased' | 'culled',
        });

        expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
          where: { cattleId: 'cattle-1', status: 'ACTIVE' },
          data: expect.objectContaining({
            status: 'ENDED',
            endReason,
          }) as unknown,
        });
      },
    );

    it('a plain archive (no reason) does not touch Lactation rows', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.cattle.update.mockResolvedValueOnce(baseRow({ isActive: false }));

      const service = make();
      await service.archiveWithReason('farm-1', 'cattle-1', {});

      expect(prisma.lactation.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('bulk — mark_sold (RAKHAL-290)', () => {
    it("auto-closes every selected cow's ACTIVE Lactation with endReason=SOLD", async () => {
      prisma.cattle.findMany.mockResolvedValueOnce([
        { id: 'cattle-1' },
        { id: 'cattle-2' },
      ]);
      prisma.cattle.updateMany.mockResolvedValueOnce({ count: 2 });

      const service = make();
      const result = await service.bulk('farm-1', {
        cattleIds: ['cattle-1', 'cattle-2'],
        action: 'mark_sold',
      });

      expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
        where: {
          cattleId: { in: ['cattle-1', 'cattle-2'] },
          status: 'ACTIVE',
        },
        data: expect.objectContaining({
          status: 'ENDED',
          endReason: 'SOLD',
        }) as unknown,
      });
      expect(result).toMatchObject({ action: 'mark_sold', updated: 2 });
    });
  });

  describe('findAll — RAKHAL-289 animalCategory filter', () => {
    it('animalCategory=HEIFER matches a cow with no ReproductionProfile row (not just totalCalvings:0)', async () => {
      const service = make();
      await service.findAll('farm-1', {
        limit: 20,
        sortOrder: 'desc',
        includeArchived: false,
        animalCategory: 'HEIFER',
      } as never);

      const calls = prisma.cattle.findMany.mock.calls as unknown as Array<
        [{ where: { AND: unknown[] } }]
      >;
      const heiferWhere = calls[0][0].where.AND;

      expect(heiferWhere).toContainEqual({ gender: 'FEMALE' });
      // The "no profile row at all" branch — this is the exact case RAKHAL-289
      // was filed over: a heifer with zero reproduction history has NO
      // `ReproductionProfile` row (`reproductiveStatus: null`), not a row with
      // `totalCalvings: 0`, so the old `reproductiveStatus=NOT_ELIGIBLE`
      // relation filter matched nothing.
      expect(heiferWhere).toContainEqual({
        OR: [
          { reproductionProfile: null },
          { reproductionProfile: { totalCalvings: 0 } },
        ],
      });
    });
  });

  describe('create — RAKHAL-291 MILKING-at-intake guard', () => {
    it('rejects productionStatus=MILKING at intake with no lactationStartDate', async () => {
      const service = make();
      await expect(
        service.create('farm-1', 'user-1', {
          tagNumber: 'TAG-1',
          gender: 'FEMALE',
          purpose: 'DAIRY',
          productionStatus: 'MILKING',
          priorCalvings: 1,
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('HEIFER/MILKING invariant — totalCalvings >= 1', () => {
    const HEIFER_MESSAGE =
      'A heifer (no calving history) cannot be set to Milking. Record a calving event, or if she was purchased already-calved, supply priorCalvings.';

    it('create() rejects MILKING on a fresh cow (totalCalvings 0) with no priorCalvings', async () => {
      const service = make();
      await expect(
        service.create('farm-1', 'user-1', {
          tagNumber: 'TAG-4',
          gender: 'FEMALE',
          purpose: 'DAIRY',
          productionStatus: 'MILKING',
          lactationStartDate: '2026-08-01',
        } as never),
      ).rejects.toThrow(HEIFER_MESSAGE);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updateStatus() rejects MILKING on a cow with totalCalvings 0 (no profile, no priorCalvings)', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce(null);

      const service = make();
      await expect(
        service.updateStatus('farm-1', 'cattle-1', {
          productionStatus: 'MILKING',
        }),
      ).rejects.toThrow(HEIFER_MESSAGE);

      expect(prisma.cattle.update).not.toHaveBeenCalled();
    });

    it('updateStatus() rejects MILKING when an existing ReproductionProfile has totalCalvings 0, even if priorCalvings is supplied', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce({
        totalCalvings: 0,
      });

      const service = make();
      await expect(
        service.updateStatus('farm-1', 'cattle-1', {
          productionStatus: 'MILKING',
          priorCalvings: 5,
        }),
      ).rejects.toThrow(HEIFER_MESSAGE);

      expect(prisma.cattle.update).not.toHaveBeenCalled();
    });

    it('create() with priorCalvings succeeds, seeds ReproductionProfile.totalCalvings, and the derived animalCategory reads COW', async () => {
      prisma.cattle.create.mockResolvedValueOnce({ id: 'cattle-9' });
      prisma.lactation.create.mockResolvedValueOnce({ id: 'lactation-x' });
      prisma.cattle.findUniqueOrThrow.mockResolvedValueOnce(
        baseRow({
          id: 'cattle-9',
          gender: 'FEMALE',
          dateOfBirth: new Date('2020-01-01'),
          productionStatus: 'MILKING',
          reproductionProfile: { reproductiveStatus: null, totalCalvings: 3 },
        }),
      );

      const service = make();
      const result = await service.create('farm-1', 'user-1', {
        tagNumber: 'TAG-5',
        gender: 'FEMALE',
        purpose: 'DAIRY',
        productionStatus: 'MILKING',
        lactationStartDate: '2026-08-01',
        priorCalvings: 3,
      } as never);

      expect(prisma.cattle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reproductionProfile: { create: { totalCalvings: 3 } },
          }) as unknown,
        }) as unknown,
      );
      expect((result as { animalCategory: string }).animalCategory).toBe('COW');
    });

    it('updateStatus() with priorCalvings on a profile-less cow succeeds and animalCategory subsequently reads COW via findOne', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow()) // getCattleOrThrow guard check
        .mockResolvedValueOnce(
          baseRow({
            gender: 'FEMALE',
            dateOfBirth: new Date('2020-01-01'),
            productionStatus: 'MILKING',
            reproductionProfile: {
              reproductiveStatus: null,
              totalCalvings: 4,
            },
          }),
        ); // findOne() at the end of updateStatus
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce(null);
      prisma.lactation.count.mockResolvedValueOnce(0);
      prisma.lactation.create.mockResolvedValueOnce({ id: 'lactation-y' });
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      const result = await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'MILKING',
        lactationStartDate: '2026-08-01',
        priorCalvings: 4,
      });

      expect(prisma.reproductionProfile.create).toHaveBeenCalledWith({
        data: { cattleId: 'cattle-1', totalCalvings: 4 },
      });
      expect((result as { animalCategory: string }).animalCategory).toBe('COW');
    });
  });
});
