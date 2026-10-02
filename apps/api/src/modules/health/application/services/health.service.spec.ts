import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SafetyWithdrawalStatus } from '@prisma/client';
import { HealthService } from './health.service';

/**
 * RAKHAL-276 — SafetyWithdrawal release-flow regression coverage. Focused on
 * the three methods this ticket touches:
 *  - `activeMilkWithholdingCattleIds` must be a pure read (no writes, ever) —
 *    the v1 design had it mutating status as a query side effect.
 *  - `sweepWithdrawalsReadyForRelease` is the only place ACTIVE ->
 *    READY_FOR_RELEASE happens (daily cron + the manual refresh route).
 *  - `releaseWithdrawal` is the only path to RELEASED.
 * Mocked Prisma + collaborators, same style as `animal-hold.service.spec.ts`.
 */
describe('HealthService — safety withdrawal release flow (RAKHAL-276)', () => {
  let prisma: {
    safetyWithdrawal: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let activityLog: { record: jest.Mock };
  let logger: { setContext: jest.Mock };

  beforeEach(() => {
    prisma = {
      safetyWithdrawal: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };
    activityLog = { record: jest.fn().mockResolvedValue(undefined) };
    logger = { setContext: jest.fn().mockReturnThis() };
  });

  const make = () =>
    new HealthService(
      prisma as never,
      undefined as never, // aqrService — unused by these methods
      activityLog as never,
      undefined as never, // medicineService
      undefined as never, // taskService
      undefined as never, // notificationService
      undefined as never, // cattleService (RAKHAL-399)
      undefined as never, // expenseService (RAKHAL-419)
      logger as never,
      undefined as never, // outcomes (RAKHAL-467)
    );

  describe('activeMilkWithholdingCattleIds', () => {
    it('still counts a cow whose withdrawal is ACTIVE and past its until date (not yet swept)', async () => {
      const pastDueRow = { cattleId: 'cow-1' };
      prisma.safetyWithdrawal.findMany.mockResolvedValueOnce([pastDueRow]);
      const service = make();

      const result = await service.activeMilkWithholdingCattleIds('farm-1', [
        'cow-1',
      ]);

      expect(result.has('cow-1')).toBe(true);
    });

    it('is a pure read — never calls update/updateMany on SafetyWithdrawal', async () => {
      prisma.safetyWithdrawal.findMany.mockResolvedValueOnce([
        { cattleId: 'cow-1' },
      ]);
      const service = make();

      await service.activeMilkWithholdingCattleIds('farm-1', ['cow-1']);

      expect(prisma.safetyWithdrawal.update).not.toHaveBeenCalled();
      expect(prisma.safetyWithdrawal.updateMany).not.toHaveBeenCalled();
    });

    it('queries by status alone (ACTIVE/READY_FOR_RELEASE unconditionally, or ACTIVE past-due) — never mutates the row it reads', async () => {
      prisma.safetyWithdrawal.findMany.mockResolvedValueOnce([]);
      const service = make();

      await service.activeMilkWithholdingCattleIds('farm-1', ['cow-1']);

      const calls = prisma.safetyWithdrawal.findMany.mock
        .calls as unknown as Array<
        [{ where: { OR: Array<{ status: unknown }> } }]
      >;
      const call = calls[0][0];
      const statusesChecked = call.where.OR.flatMap((clause) => {
        const s = clause.status as
          | SafetyWithdrawalStatus
          | { in: SafetyWithdrawalStatus[] };
        return typeof s === 'object' ? s.in : [s];
      });
      expect(statusesChecked).toEqual(
        expect.arrayContaining([
          SafetyWithdrawalStatus.ACTIVE,
          SafetyWithdrawalStatus.READY_FOR_RELEASE,
        ]),
      );
    });

    it('returns an empty set without querying when given no cattle ids', async () => {
      const service = make();

      const result = await service.activeMilkWithholdingCattleIds('farm-1', []);

      expect(result.size).toBe(0);
      expect(prisma.safetyWithdrawal.findMany).not.toHaveBeenCalled();
    });
  });

  describe('sweepWithdrawalsReadyForRelease', () => {
    it('transitions ACTIVE + past-due rows to READY_FOR_RELEASE (this is where the mutation belongs, not the read)', async () => {
      prisma.safetyWithdrawal.updateMany.mockResolvedValueOnce({ count: 2 });
      const service = make();

      const result = await service.sweepWithdrawalsReadyForRelease('farm-1');

      expect(prisma.safetyWithdrawal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId: 'farm-1',
            status: SafetyWithdrawalStatus.ACTIVE,
          }) as unknown,
          data: { status: SafetyWithdrawalStatus.READY_FOR_RELEASE },
        }),
      );
      expect(result).toEqual({ updated: 2 });
    });

    it('sweeps every farm when called with no farmId (the daily cron case)', async () => {
      prisma.safetyWithdrawal.updateMany.mockResolvedValueOnce({ count: 5 });
      const service = make();

      await service.sweepWithdrawalsReadyForRelease();

      const calls = prisma.safetyWithdrawal.updateMany.mock
        .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
      expect(calls[0][0].where.farmId).toBeUndefined();
    });
  });

  describe('releaseWithdrawal', () => {
    it('404s when the withdrawal is not found in the farm', async () => {
      prisma.safetyWithdrawal.findFirst.mockResolvedValueOnce(null);
      const service = make();

      await expect(
        service.releaseWithdrawal('farm-1', 'sw-x', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.safetyWithdrawal.update).not.toHaveBeenCalled();
    });

    it('is idempotent when already RELEASED', async () => {
      const already = {
        id: 'sw-1',
        farmId: 'farm-1',
        cattleId: 'cow-1',
        status: SafetyWithdrawalStatus.RELEASED,
      };
      prisma.safetyWithdrawal.findFirst.mockResolvedValueOnce(already);
      const service = make();

      const result = await service.releaseWithdrawal(
        'farm-1',
        'sw-1',
        'user-1',
      );

      expect(result).toBe(already);
      expect(prisma.safetyWithdrawal.update).not.toHaveBeenCalled();
      expect(activityLog.record).not.toHaveBeenCalled();
    });

    it('rejects releasing a CANCELLED withdrawal', async () => {
      prisma.safetyWithdrawal.findFirst.mockResolvedValueOnce({
        id: 'sw-1',
        farmId: 'farm-1',
        cattleId: 'cow-1',
        status: SafetyWithdrawalStatus.CANCELLED,
      });
      const service = make();

      await expect(
        service.releaseWithdrawal('farm-1', 'sw-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.safetyWithdrawal.update).not.toHaveBeenCalled();
    });

    it('releases an ACTIVE or READY_FOR_RELEASE withdrawal and records activity — the only path to RELEASED', async () => {
      prisma.safetyWithdrawal.findFirst.mockResolvedValueOnce({
        id: 'sw-1',
        farmId: 'farm-1',
        cattleId: 'cow-1',
        status: SafetyWithdrawalStatus.READY_FOR_RELEASE,
      });
      const released = {
        id: 'sw-1',
        farmId: 'farm-1',
        cattleId: 'cow-1',
        status: SafetyWithdrawalStatus.RELEASED,
      };
      prisma.safetyWithdrawal.update.mockResolvedValueOnce(released);
      const service = make();

      const result = await service.releaseWithdrawal(
        'farm-1',
        'sw-1',
        'user-2',
      );

      expect(prisma.safetyWithdrawal.update).toHaveBeenCalledWith({
        where: { id: 'sw-1' },
        data: { status: SafetyWithdrawalStatus.RELEASED },
      });
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          farmId: 'farm-1',
          actorId: 'user-2',
          relatedCattleId: 'cow-1',
        }),
      );
      expect(result).toBe(released);
    });
  });
});
