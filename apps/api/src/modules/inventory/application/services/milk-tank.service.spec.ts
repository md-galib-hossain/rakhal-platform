import { MilkTankService } from './milk-tank.service';

describe('MilkTankService.ensureDefaultSellableTank', () => {
  const logger = { setContext: jest.fn(), info: jest.fn() };
  logger.setContext.mockReturnValue(logger);

  const make = () =>
    new MilkTankService({} as never, logger as never, {} as never);

  const makeTx = () => ({
    milkTank: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  });

  it('returns the farm’s existing sellable tank without locking or creating', async () => {
    const tx = makeTx();
    tx.milkTank.findFirst.mockResolvedValueOnce({ id: 'tank-1' });

    const tank = await make().ensureDefaultSellableTank(
      'farm-1',
      'u1',
      tx as never,
    );

    expect(tank).toEqual({ id: 'tank-1' });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.milkTank.create).not.toHaveBeenCalled();
  });

  it('creates an empty primary "Main Tank" when the farm has no tank at all', async () => {
    const tx = makeTx();
    tx.milkTank.findFirst.mockResolvedValue(null);
    tx.milkTank.count.mockResolvedValue(0);
    tx.milkTank.create.mockResolvedValue({ id: 'new-tank' });

    const tank = await make().ensureDefaultSellableTank(
      'farm-1',
      'u1',
      tx as never,
    );

    expect(tank).toEqual({ id: 'new-tank' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.milkTank.create).toHaveBeenCalledWith({
      data: {
        farmId: 'farm-1',
        name: 'Main Tank',
        tankType: 'SELLABLE',
        totalCapacityL: 100_000,
        currentVolumeL: 0,
        isPrimary: true,
        createdBy: 'u1',
      },
    });
  });

  it('does not steal primary from a withholding tank that already holds it', async () => {
    const tx = makeTx();
    tx.milkTank.findFirst.mockResolvedValue(null);
    tx.milkTank.count.mockResolvedValue(1);
    tx.milkTank.create.mockResolvedValue({ id: 'new-tank' });

    await make().ensureDefaultSellableTank('farm-1', 'u1', tx as never);

    expect(tx.milkTank.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPrimary: false }) as unknown,
    });
  });

  it('returns the tank a racing caller created while this one waited on the lock', async () => {
    const tx = makeTx();
    tx.milkTank.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'raced-tank' });

    const tank = await make().ensureDefaultSellableTank(
      'farm-1',
      'u1',
      tx as never,
    );

    expect(tank).toEqual({ id: 'raced-tank' });
    expect(tx.milkTank.create).not.toHaveBeenCalled();
  });
});
