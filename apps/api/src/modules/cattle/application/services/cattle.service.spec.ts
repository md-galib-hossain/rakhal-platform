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
    cattle: { findFirst: jest.Mock; update: jest.Mock };
    lactation: { findFirst: jest.Mock };
  };
  let logger: { setContext: jest.Mock; info: jest.Mock; warn: jest.Mock };

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
      cattle: { findFirst: jest.fn(), update: jest.fn() },
      lactation: { findFirst: jest.fn() },
    };
    logger = {
      setContext: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  const make = () =>
    new CattleService(
      prisma as never,
      {} as never, // AqrService — unused by these paths
      {} as never, // SubscriptionAccessService — unused
      { presentUrls: jest.fn(), signThumbs: jest.fn() } as never, // MediaService
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
      prisma.cattle.update.mockResolvedValueOnce({});

      const service = make();
      await service.updateStatus('farm-1', 'cattle-1', {
        productionStatus: 'MILKING',
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
  });
});
