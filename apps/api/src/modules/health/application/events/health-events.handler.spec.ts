import { BadRequestException } from '@nestjs/common';
import { HealthEventHandler } from './health-events.handler';

describe('HealthEventHandler — TREATMENT condition rule', () => {
  const health = {
    recordTreatment: jest.fn().mockResolvedValue({ results: [] }),
    logTreatment: jest.fn().mockResolvedValue({ id: 'log-1' }),
  };
  const prisma = { healthCase: { findFirst: jest.fn() } };
  const handler = new HealthEventHandler(
    health as never,
    prisma as never,
    { register: jest.fn() } as never,
  );

  const input = (over: Record<string, unknown> = {}) =>
    ({
      farmId: 'farm-1',
      userId: 'user-1',
      cattleId: 'cow-1',
      eventAt: new Date('2026-10-01T00:00:00Z'),
      provenance: 'RECORDED',
      notes: undefined,
      payload: {
        medicineName: 'oxy',
        outsideInventory: true,
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'IM',
      },
      ...over,
    }) as never;

  beforeEach(() => jest.clearAllMocks());

  it('finding stays TREATMENT_NEW_CASE when no open case', async () => {
    prisma.healthCase.findFirst.mockResolvedValue(null);
    await expect(
      handler.findingsFor('TREATMENT', {
        cattleId: 'cow-1',
        payload: {},
      }),
    ).resolves.toEqual(['TREATMENT_NEW_CASE']);
  });

  it('no open case + no condition -> 400 CONDITION_REQUIRED, nothing recorded', async () => {
    prisma.healthCase.findFirst.mockResolvedValue(null);
    const err: unknown = await handler
      .handle('TREATMENT', input())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(
      JSON.stringify((err as BadRequestException).getResponse()),
    ).toContain('CONDITION_REQUIRED');
    expect(health.recordTreatment).not.toHaveBeenCalled();
  });

  it('no open case + condition -> passed to recordTreatment', async () => {
    prisma.healthCase.findFirst.mockResolvedValue(null);
    await handler.handle(
      'TREATMENT',
      input({
        payload: {
          medicineName: 'oxy',
          outsideInventory: true,
          doseAmount: 5,
          doseUnit: 'mL',
          route: 'IM',
          condition: 'MASTITIS',
        },
      }),
    );
    expect(health.recordTreatment).toHaveBeenCalledWith(
      'farm-1',
      'user-1',
      expect.objectContaining({ condition: 'MASTITIS', careType: 'CURATIVE' }),
    );
  });

  it('open case -> logTreatment, no condition needed', async () => {
    prisma.healthCase.findFirst.mockResolvedValue({ id: 'case-1' });
    await handler.handle('TREATMENT', input());
    expect(health.logTreatment).toHaveBeenCalled();
    expect(health.recordTreatment).not.toHaveBeenCalled();
  });

  it('HISTORICAL without condition still works (not enforced)', async () => {
    prisma.healthCase.findFirst.mockResolvedValue(null);
    await handler.handle('TREATMENT', input({ provenance: 'HISTORICAL' }));
    expect(health.recordTreatment).toHaveBeenCalled();
  });

  it('VACCINATION needs no condition', async () => {
    await handler.handle('VACCINATION', input());
    expect(health.recordTreatment).toHaveBeenCalledWith(
      'farm-1',
      'user-1',
      expect.objectContaining({ careType: 'PREVENTIVE' }),
    );
  });
});
