import { BadRequestException } from '@nestjs/common';
import { HerdStatus } from '@prisma/client';
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
    dryPeriod: { findFirst: jest.Mock; create: jest.Mock };
    reproductionProfile: { findUnique: jest.Mock; create: jest.Mock };
    animalHold: { findMany: jest.Mock };
    cattleDisposition: { findFirst: jest.Mock; create: jest.Mock };
    breedingEvent: { count: jest.Mock };
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
      dryPeriod: { findFirst: jest.fn(), create: jest.fn() },
      reproductionProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      animalHold: { findMany: jest.fn().mockResolvedValue([]) },
      cattleDisposition: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      // RAKHAL-400: archiveWithReason's real-history guard checks these three
      // before a plain (non-disposition) delete — default to 0 (no history)
      // so existing plain-archive tests keep passing unless a test overrides.
      milkLogEntry: { count: jest.fn().mockResolvedValue(0) },
      healthCase: { count: jest.fn().mockResolvedValue(0) },
      breedingEvent: { count: jest.fn().mockResolvedValue(0) },
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
        // RAKHAL-401: lifecycle sub-stage boundaries — real defaults so
        // `composeStatus()`'s `lifecycleSubStage` derivation behaves the same
        // as the hardcoded fallback used when no `reproCtx` is supplied.
        cattleLifecycleWeaningDays: 60,
        cattleLifecycleGrowingStartDays: 180,
        cattleLifecycleBreedingAgeDays: 390,
      }),
    };
    // RAKHAL-307: `create()`/`update()` now end certain paths with
    // `refreshDerivedState()` — a no-op stub here, its own behavior is
    // covered by `reproduction-derivation.service.spec.ts`.
    derivation = {
      refreshDerivedState: jest.fn().mockResolvedValue(undefined),
    };
  });

  // RAKHAL-319: create()'s intakeBreeding/intakeHeat branches call these;
  // no test row in this file sets either field, so both stay unreachable —
  // stub is here only to satisfy the constructor.
  const reproductionService = {
    createBreedingEvent: jest.fn().mockResolvedValue(undefined),
    createHeatEvent: jest.fn().mockResolvedValue(undefined),
  };

  // RAKHAL-399: recordDisposition's post-commit cleanup calls these — no test
  // row in this file exercises their behavior (covered by task.service.spec.ts
  // / animal-hold.service.spec.ts), stubs are here only to satisfy the
  // constructor and no-op quietly.
  const taskService = {
    completeForCattle: jest.fn().mockResolvedValue({ completedTaskIds: [] }),
  };
  const animalHoldService = {
    releaseAllForCattle: jest.fn().mockResolvedValue(undefined),
  };

  const make = () =>
    new CattleService(
      prisma as never,
      { applyEvent: jest.fn().mockResolvedValue({ aqrScore: 0 }) } as never, // AqrService
      subscriptionAccess as never, // SubscriptionAccessService
      { presentUrls: jest.fn(), signThumbs: jest.fn() } as never, // MediaService
      farmSettings as never, // FarmSettingsService (RAKHAL-279)
      derivation as never, // ReproductionDerivationService (RAKHAL-307)
      reproductionService as never, // ReproductionService (RAKHAL-319)
      taskService as never, // TaskService (RAKHAL-399)
      animalHoldService as never, // AnimalHoldService (RAKHAL-399)
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

    it('RD-048: allows MILKING when an active Lactation row already exists, deriving productionStatus rather than writing it raw', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow()) // getCattleOrThrow guard check
        .mockResolvedValueOnce(baseRow({ productionStatus: 'MILKING' })); // findOne() at the end of updateStatus
      prisma.lactation.findFirst.mockResolvedValueOnce({ id: 'lactation-1' });
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce({
        totalCalvings: 1,
      });

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'MILKING',
      });

      // Already backed by a real Lactation — nothing to create, no raw write; derivation alone
      // is what persists productionStatus (RD-048 closes the old direct `cattle.update` write).
      expect(prisma.cattle.update).not.toHaveBeenCalled();
      expect(derivation.refreshDerivedState).toHaveBeenCalledWith(
        'farm-1',
        'cattle-1',
      );
    });

    it('creates a purchase-intake Lactation (startReason PURCHASED_LACTATING) when lactationStartDate + priorCalvings are supplied and no active Lactation exists', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow()) // getCattleOrThrow guard check
        .mockResolvedValueOnce(baseRow({ productionStatus: 'MILKING' })); // findOne() at the end of updateStatus
      prisma.lactation.findFirst.mockResolvedValueOnce(null);
      prisma.reproductionProfile.findUnique.mockResolvedValueOnce(null);
      prisma.lactation.count.mockResolvedValueOnce(0);
      prisma.lactation.create.mockResolvedValueOnce({ id: 'lactation-new' });

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
      // RD-048: the real Lactation just created is what backs MILKING now — no raw
      // `cattle.update({data:{productionStatus}})` inside the transaction anymore.
      expect(prisma.cattle.update).not.toHaveBeenCalled();
      expect(derivation.refreshDerivedState).toHaveBeenCalledWith(
        'farm-1',
        'cattle-1',
      );
    });

    it('RD-048: rejects DRY with no open DryPeriod and no dryOffStartDate', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.dryPeriod.findFirst.mockResolvedValueOnce(null);

      const service = make();
      await expect(
        service.updateStatus('farm-1', 'cattle-1', {
          productionStatus: 'DRY',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.dryPeriod.create).not.toHaveBeenCalled();
      expect(derivation.refreshDerivedState).not.toHaveBeenCalled();
    });

    it('RD-048: creates a DryPeriod when none exists and dryOffStartDate is supplied, then derives productionStatus', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow())
        .mockResolvedValueOnce(baseRow({ productionStatus: 'DRY' }));
      prisma.dryPeriod.findFirst.mockResolvedValueOnce(null);
      prisma.dryPeriod.create.mockResolvedValueOnce({ id: 'dry-1' });

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'DRY',
        dryOffStartDate: '2026-08-01',
      });

      expect(prisma.dryPeriod.create).toHaveBeenCalledWith({
        data: {
          cattleId: 'cattle-1',
          startDate: new Date('2026-08-01'),
        },
      });
      expect(prisma.cattle.update).not.toHaveBeenCalled();
      expect(derivation.refreshDerivedState).toHaveBeenCalledWith(
        'farm-1',
        'cattle-1',
      );
    });

    it('RD-048: DRY is a no-op write (still derives) when an open DryPeriod already exists', async () => {
      prisma.cattle.findFirst
        .mockResolvedValueOnce(baseRow())
        .mockResolvedValueOnce(baseRow({ productionStatus: 'DRY' }));
      prisma.dryPeriod.findFirst.mockResolvedValueOnce({ id: 'dry-existing' });

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'DRY',
      });

      expect(prisma.dryPeriod.create).not.toHaveBeenCalled();
      expect(derivation.refreshDerivedState).toHaveBeenCalledWith(
        'farm-1',
        'cattle-1',
      );
    });
  });

  describe('archiveWithReason', () => {
    it('reason=culled sets HerdStatus.CULLED and nulls productionStatus', async () => {
      // RAKHAL-399: culled now delegates to recordDisposition, which calls
      // getCattleOrThrow (findFirst) a second time, then archiveWithReason
      // ends with findOne() (a third findFirst) — persistent mock, not Once.
      prisma.cattle.findFirst.mockResolvedValue(baseRow());
      prisma.cattleDisposition.create.mockResolvedValueOnce({
        id: 'disposition-culled',
        type: 'CULL',
        cattleId: 'cattle-1',
      });
      prisma.cattle.update.mockResolvedValueOnce(
        baseRow({ herdStatus: HerdStatus.CULLED, deletedAt: null }),
      );

      const service = make();
      await service.archiveWithReason(
        'farm-1',
        'cattle-1',
        { reason: 'culled' },
        'user-1',
      );

      expect(lastUpdateData()).toMatchObject({
        productionStatus: null,
        herdStatus: HerdStatus.CULLED,
      });
    });

    it('a plain archive (no reason) is a soft delete — herdStatus and productionStatus untouched', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(
        baseRow({ productionStatus: 'MILKING' }),
      );
      prisma.cattle.update.mockResolvedValueOnce(
        baseRow({ herdStatus: HerdStatus.ACTIVE, deletedAt: new Date() }),
      );

      const service = make();
      await service.archiveWithReason('farm-1', 'cattle-1', {}, 'user-1');

      const data = lastUpdateData();
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.herdStatus).toBeUndefined();
      expect(data.productionStatus).toBeUndefined();
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
        prisma.cattle.findFirst.mockResolvedValue(baseRow());
        prisma.cattleDisposition.create.mockResolvedValueOnce({
          id: 'disposition-x',
          type: 'SALE',
          cattleId: 'cattle-1',
        });
        prisma.cattle.update.mockResolvedValueOnce(
          baseRow({ isActive: false }),
        );

        const service = make();
        await service.archiveWithReason(
          'farm-1',
          'cattle-1',
          { reason: reason as 'sold' | 'deceased' | 'culled' },
          'user-1',
        );

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
      await service.archiveWithReason('farm-1', 'cattle-1', {}, 'user-1');

      expect(prisma.lactation.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('bulk — mark_sold (RAKHAL-290)', () => {
    it("auto-closes every selected cow's ACTIVE Lactation with endReason=SOLD", async () => {
      prisma.cattle.findMany.mockResolvedValueOnce([
        { id: 'cattle-1' },
        { id: 'cattle-2' },
      ]);
      prisma.cattleDisposition.create
        .mockResolvedValueOnce({
          id: 'd-1',
          type: 'SALE',
          cattleId: 'cattle-1',
        })
        .mockResolvedValueOnce({
          id: 'd-2',
          type: 'SALE',
          cattleId: 'cattle-2',
        });
      prisma.cattle.update.mockResolvedValue({});

      const service = make();
      const result = await service.bulk(
        'farm-1',
        { cattleIds: ['cattle-1', 'cattle-2'], action: 'mark_sold' },
        'user-1',
      );

      expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
        where: { cattleId: 'cattle-1', status: 'ACTIVE' },
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
        includeDeleted: false,
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

  // RAKHAL-344: the new consolidated SALE/DEATH/CULL/TRANSFER exit path.
  describe('recordDisposition', () => {
    it('SALE closes the ACTIVE lactation with LactationEndReason.SOLD and flips status/isActive/soldAt/dispositionId', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.cattleDisposition.findFirst.mockResolvedValueOnce(null);
      prisma.cattleDisposition.create.mockResolvedValueOnce({
        id: 'disposition-1',
        type: 'SALE',
        cattleId: 'cattle-1',
      });
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      const disposition = await service.recordDisposition(
        'farm-1',
        'user-1',
        'cattle-1',
        { type: 'SALE', date: new Date('2026-08-22') },
      );

      expect(disposition).toMatchObject({ id: 'disposition-1', type: 'SALE' });
      expect(prisma.cattleDisposition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          farmId: 'farm-1',
          cattleId: 'cattle-1',
          type: 'SALE',
          createdById: 'user-1',
        }) as unknown,
      });
      expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
        where: { cattleId: 'cattle-1', status: 'ACTIVE' },
        data: expect.objectContaining({
          status: 'ENDED',
          endReason: 'SOLD',
        }) as unknown,
      });
      expect(lastUpdateData()).toMatchObject({
        herdStatus: HerdStatus.SOLD,
        productionStatus: null,
        dispositionId: 'disposition-1',
        soldAt: new Date('2026-08-22'),
      });
    });

    it('rejects re-selling a cow that already has a SALE disposition', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.cattleDisposition.findFirst.mockResolvedValueOnce({
        id: 'existing-disposition',
      });

      const service = make();
      await expect(
        service.recordDisposition('farm-1', 'user-1', 'cattle-1', {
          type: 'SALE',
          date: new Date(),
        }),
      ).rejects.toThrow(
        'This animal has already been sold and cannot be sold again.',
      );

      expect(prisma.cattleDisposition.create).not.toHaveBeenCalled();
      expect(prisma.cattle.update).not.toHaveBeenCalled();
    });

    it.each([
      ['DEATH', 'DEATH', HerdStatus.DECEASED],
      ['CULL', 'CULLED', HerdStatus.CULLED],
    ])(
      '%s closes the ACTIVE lactation with LactationEndReason.%s and sets status %s',
      async (type, endReason, status) => {
        prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
        prisma.cattleDisposition.findFirst.mockResolvedValueOnce(null);
        prisma.cattleDisposition.create.mockResolvedValueOnce({
          id: 'disposition-2',
          type,
          cattleId: 'cattle-1',
        });
        prisma.cattle.update.mockResolvedValueOnce({});

        const service = make();
        await service.recordDisposition('farm-1', 'user-1', 'cattle-1', {
          type: type as never,
          date: new Date(),
        });

        expect(prisma.lactation.updateMany).toHaveBeenCalledWith({
          where: { cattleId: 'cattle-1', status: 'ACTIVE' },
          data: expect.objectContaining({
            status: 'ENDED',
            endReason,
          }) as unknown,
        });
        expect(lastUpdateData()).toMatchObject({ herdStatus: status });
      },
    );

    it('TRANSFER sets herdStatus SOLD (folded into SOLD, RAKHAL-397) and does not touch any Lactation row', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(baseRow());
      prisma.cattleDisposition.findFirst.mockResolvedValueOnce(null);
      prisma.cattleDisposition.create.mockResolvedValueOnce({
        id: 'disposition-3',
        type: 'TRANSFER',
        cattleId: 'cattle-1',
      });
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      await service.recordDisposition('farm-1', 'user-1', 'cattle-1', {
        type: 'TRANSFER',
        date: new Date(),
      });

      expect(prisma.lactation.updateMany).not.toHaveBeenCalled();
      expect(lastUpdateData()).toMatchObject({
        herdStatus: HerdStatus.SOLD,
      });
    });
  });

  describe('findOne — RD-045 uncapped repeat-breeder count', () => {
    it('uses a real breedingEvent.count() (not the capped take:20 array) to decide REPEAT_BREEDER', async () => {
      const lastCalvingDate = new Date('2026-01-01');
      // 20 rows is `defaultInclude()`'s own cap — same length the list path would see.
      const cappedBreedingEvents = Array.from({ length: 20 }, (_, i) => ({
        status: 'PREGNANCY_CHECK_PENDING',
        breedingDate: new Date(
          `2026-02-${String((i % 27) + 1).padStart(2, '0')}`,
        ),
        expectedPregnancyCheckDate: null,
      }));
      prisma.cattle.findFirst.mockResolvedValueOnce(
        baseRow({
          gender: 'FEMALE',
          reproductionProfile: {
            reproductiveStatus: 'OPEN',
            totalCalvings: 1,
            totalAbortions: 0,
            lastCalvingDate,
          },
          breedingEvents: cappedBreedingEvents,
        }),
      );
      // The real count (25) exceeds the capped array length (20) — proves the alert reads
      // the uncapped query, not `row.breedingEvents.length`.
      prisma.breedingEvent.count.mockResolvedValueOnce(25);
      // Threshold sits strictly between the capped (20) and real (25) counts: the pre-RD-045
      // capped path would NOT fire REPEAT_BREEDER here, the fixed uncapped path does.
      farmSettings.getEffective.mockResolvedValueOnce({
        reproHeatWindowDays: 3,
        reproCloseUpWindowDays: 21,
        reproOverduePregnancyCheckDays: 7,
        reproCalvingOverdueDays: 7,
        reproRepeatBreederThreshold: 22,
        reproLongDaysOpenDays: 120,
        lactationFreshDays: 21,
        lactationEarlyDays: 100,
        lactationMidDays: 200,
        pregnancyEarlyDays: 90,
        pregnancyMidDays: 180,
        cattleLifecycleWeaningDays: 60,
        cattleLifecycleGrowingStartDays: 180,
        cattleLifecycleBreedingAgeDays: 390,
      });

      const service = make();
      const result = await service.findOne('farm-1', 'cattle-1');

      expect(prisma.breedingEvent.count).toHaveBeenCalledWith({
        where: {
          cattleId: 'cattle-1',
          breedingDate: { gt: lastCalvingDate },
        },
      });
      expect(result.reproductionAlerts).toContain('REPEAT_BREEDER');
    });

    it('skips the extra count() query entirely for a male animal', async () => {
      prisma.cattle.findFirst.mockResolvedValueOnce(
        baseRow({ gender: 'MALE' }),
      );

      const service = make();
      await service.findOne('farm-1', 'cattle-1');

      expect(prisma.breedingEvent.count).not.toHaveBeenCalled();
    });
  });
});
