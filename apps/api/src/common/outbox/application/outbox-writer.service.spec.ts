import { OutboxWriterService } from './outbox-writer.service';

describe('OutboxWriterService', () => {
  it('upserts on (farmId, idempotencyKey) so a replayed write never inserts a second row', async () => {
    const existing = { id: 'existing-row' };
    const upsert = jest.fn().mockResolvedValue(existing);
    const db = { outboxEvent: { upsert } };
    const service = new OutboxWriterService({} as never);

    const result = await service.write(
      {
        farmId: 'farm-1',
        eventType: 'sale.recorded',
        payload: { amount: 100 },
        idempotencyKey: 'op-1',
      },
      db as never,
    );

    expect(result).toBe(existing);
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = (upsert.mock.calls[0] as unknown[])[0] as {
      where: unknown;
      update: unknown;
      create: unknown;
    };
    expect(call.where).toEqual({
      farmId_idempotencyKey: { farmId: 'farm-1', idempotencyKey: 'op-1' },
    });
    // The update branch must be a no-op — a replay must never mutate an
    // already-existing row (e.g. flip a PROCESSED row back to something else).
    expect(call.update).toEqual({});
    expect(call.create).toMatchObject({
      farmId: 'farm-1',
      eventType: 'sale.recorded',
      idempotencyKey: 'op-1',
    });
  });

  it('defaults to the injected PrismaService when no transaction client is passed', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'row' });
    const prisma = { outboxEvent: { upsert } };
    const service = new OutboxWriterService(prisma as never);

    await service.write({
      farmId: 'farm-1',
      eventType: 'x',
      payload: {},
      idempotencyKey: 'k',
    });

    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
