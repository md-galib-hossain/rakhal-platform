import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  HealthCareType,
  HealthCaseStatus,
  MedicineRoute,
  SafetyWithdrawalStatus,
} from '@prisma/client';
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

  describe('recordTreatment — careType handling', () => {
    it('creates a CLOSED case with 100% progress for PREVENTIVE careType and does not attach to active cases', async () => {
      const createCaseMock = jest.fn().mockResolvedValue({ id: 'case-prev-1' });
      const mockPrisma = {
        cattle: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'cow-1', tagNumber: 'TAG-1', name: 'Lokkhi', shedId: 'shed-1' },
          ]),
        },
        healthCase: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn(async (callback) => {
          const tx = {
            healthCase: {
              create: createCaseMock,
              findMany: jest.fn().mockResolvedValue([]),
            },
            treatmentLog: {
              create: jest.fn().mockResolvedValue({ id: 'log-1' }),
            },
            medicineStockMovement: { updateMany: jest.fn() },
            safetyWithdrawal: { create: jest.fn() },
          };
          return callback(tx);
        }),
      };
      const mockMedicineService = {
        getMedicine: jest.fn().mockResolvedValue(null),
        decrementForTreatment: jest.fn().mockResolvedValue(null),
      };
      const mockAqr = { applyEvent: jest.fn().mockResolvedValue(undefined) };
      const mockLogger = {
        setContext: jest.fn().mockReturnValue({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        }),
      };

      const service = new HealthService(
        mockPrisma as never,
        mockAqr as never,
        activityLog as never,
        mockMedicineService as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        mockLogger as never,
        undefined as never,
      );

      const result = await service.recordTreatment('farm-1', 'user-1', {
        cattleIds: ['cow-1'],
        outsideInventory: true,
        medicineName: 'Vitamin AD3E',
        doseAmount: 10,
        doseUnit: 'ml',
        route: MedicineRoute.IM,
        treatedAt: '2026-10-27T10:00:00.000Z',
        careType: HealthCareType.PREVENTIVE,
      } as never);

      expect(mockPrisma.healthCase.findFirst).not.toHaveBeenCalled();
      expect(createCaseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            careType: HealthCareType.PREVENTIVE,
            status: HealthCaseStatus.CLOSED,
            totalSteps: 1,
            currentStep: 1,
            progressPercentage: 100,
            closeReason: 'preventive_routine',
          }),
        }),
      );
      expect(result.appliedCount).toBe(1);
      expect(mockAqr.applyEvent).toHaveBeenCalledWith(
        'farm-1',
        'cow-1',
        'treatment_completed',
        expect.objectContaining({
          actionDetails: expect.stringContaining('Preventive / Wellness'),
        }),
      );
    });

    it('creates an ACTIVE case for CURATIVE careType and attaches to open case when present', async () => {
      const openCase = { id: 'case-open-1', shedId: 'shed-1' };
      const createCaseMock = jest.fn();
      const mockPrisma = {
        cattle: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'cow-1', tagNumber: 'TAG-1', name: 'Lokkhi', shedId: 'shed-1' },
          ]),
        },
        healthCase: {
          findFirst: jest.fn().mockResolvedValue(openCase),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn(async (callback) => {
          const tx = {
            healthCase: {
              create: createCaseMock,
              findUniqueOrThrow: jest.fn().mockResolvedValue({
                farmId: 'farm-1',
                cattleId: 'cow-1',
                caseCode: 'HC-001',
                healthPlanId: null,
                status: HealthCaseStatus.ACTIVE,
              }),
              update: jest.fn(),
            },
            healthTask: {
              count: jest.fn().mockResolvedValue(0),
            },
            treatmentLog: {
              create: jest.fn().mockResolvedValue({ id: 'log-1' }),
            },
            medicineStockMovement: { updateMany: jest.fn() },
            safetyWithdrawal: { create: jest.fn() },
          };
          return callback(tx);
        }),
      };
      const mockMedicineService = {
        getMedicine: jest.fn().mockResolvedValue(null),
        decrementForTreatment: jest.fn().mockResolvedValue(null),
      };
      const mockAqr = { applyEvent: jest.fn().mockResolvedValue(undefined) };
      const mockLogger = {
        setContext: jest.fn().mockReturnValue({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        }),
      };

      const service = new HealthService(
        mockPrisma as never,
        mockAqr as never,
        activityLog as never,
        mockMedicineService as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        mockLogger as never,
        undefined as never,
      );

      const result = await service.recordTreatment('farm-1', 'user-1', {
        cattleIds: ['cow-1'],
        outsideInventory: true,
        medicineName: 'Penicillin',
        doseAmount: 20,
        doseUnit: 'ml',
        route: MedicineRoute.IM,
        treatedAt: '2026-10-27T10:00:00.000Z',
        careType: HealthCareType.CURATIVE,
      } as never);

      expect(mockPrisma.healthCase.findFirst).toHaveBeenCalled();
      expect(createCaseMock).not.toHaveBeenCalled();
      expect(result.appliedCount).toBe(1);
      expect(mockAqr.applyEvent).toHaveBeenCalledWith(
        'farm-1',
        'cow-1',
        'treatment_completed',
        expect.objectContaining({
          actionDetails: expect.stringContaining('Quick treatment administered'),
        }),
      );
    });
  });

  describe('getTreatmentLogs', () => {
    it('returns cursor-paginated treatment logs matching search and farm filters', async () => {
      const mockRows = [
        {
          id: 'log-1',
          cattleId: 'cow-1',
          medicineName: 'Vitamin AD3E',
          doseAmount: 10,
          doseUnit: 'ml',
          route: MedicineRoute.IM,
          administeredAt: new Date('2026-10-27T10:00:00Z'),
          cattle: { id: 'cow-1', name: 'Lokkhi', tagNumber: 'TAG-1', image: null },
          healthCase: {
            id: 'case-1',
            caseCode: 'HC-001',
            careType: HealthCareType.PREVENTIVE,
            condition: null,
            note: 'Routine vaccine',
          },
        },
      ];
      const mockPrisma = {
        treatmentLog: {
          findMany: jest.fn().mockResolvedValue(mockRows),
        },
      };
      const mockLogger = {
        setContext: jest.fn().mockReturnValue({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        }),
      };

      const service = new HealthService(
        mockPrisma as never,
        undefined as never,
        activityLog as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        undefined as never,
        mockLogger as never,
        undefined as never,
      );

      const page = await service.getTreatmentLogs('farm-1', {
        search: 'Lokkhi',
        limit: 10,
      } as never);

      expect(mockPrisma.treatmentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId: 'farm-1',
            voidedAt: null,
          }),
        }),
      );
      expect(page.items).toHaveLength(1);
      expect(page.items[0].medicineName).toBe('Vitamin AD3E');
    });
  });
});
