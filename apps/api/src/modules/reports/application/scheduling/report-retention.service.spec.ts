/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest mock call inspection */
import { ReportRetentionService } from './report-retention.service';

const NOW = new Date('2026-10-24T12:00:00Z');

const logger = () => {
  const l = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { setContext: () => l, l };
};

function build(rows: Array<{ id: string; artifactKey: string | null }>) {
  const findMany = jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]);
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const storageDelete = jest.fn().mockResolvedValue(undefined);
  const lg = logger();
  const svc = new ReportRetentionService(
    { report: { findMany, deleteMany } } as never,
    { delete: storageDelete } as never,
    lg as never,
  );
  return { svc, findMany, deleteMany, storageDelete, lg };
}

describe('ReportRetentionService', () => {
  it('deletes the artifact before the row, and rows without an artifact directly', async () => {
    const order: string[] = [];
    const t = build([
      { id: 'r1', artifactKey: 'k1' },
      { id: 'r2', artifactKey: null },
    ]);
    t.storageDelete.mockImplementation(() => {
      order.push('storage');
      return Promise.resolve();
    });
    t.deleteMany.mockImplementation(() => {
      order.push('row');
      return Promise.resolve({ count: 1 });
    });
    const res = await t.svc.cleanup(NOW);
    expect(order).toEqual(['storage', 'row', 'row']);
    expect(t.storageDelete).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      considered: 2,
      deleted: 2,
      storageFailures: 0,
    });
  });

  it('keeps the row (no row delete) when the storage delete throws, and counts the failure', async () => {
    const t = build([
      { id: 'r1', artifactKey: 'bad' },
      { id: 'r2', artifactKey: 'ok' },
    ]);
    t.storageDelete.mockImplementation((key: string) =>
      key === 'bad' ? Promise.reject(new Error('r2 down')) : Promise.resolve(),
    );
    const res = await t.svc.cleanup(NOW);
    expect(res).toMatchObject({ deleted: 1, storageFailures: 1 });
    expect(t.deleteMany).toHaveBeenCalledTimes(1);
    expect(t.deleteMany.mock.calls[0][0].where.id).toBe('r2');
    expect(t.lg.l.warn).toHaveBeenCalled();
  });

  it('never selects PROCESSING and re-asserts it on the delete', async () => {
    const t = build([{ id: 'r1', artifactKey: null }]);
    await t.svc.cleanup(NOW);
    expect(t.findMany.mock.calls[0][0].where.status).toEqual({
      not: 'PROCESSING',
    });
    expect(t.deleteMany.mock.calls[0][0].where).toEqual({
      id: 'r1',
      status: { not: 'PROCESSING' },
    });
  });

  it('selects expired, soft-deleted past grace (7d) and FAILED older than 30d only', async () => {
    const t = build([]);
    await t.svc.cleanup(NOW);
    const or = t.findMany.mock.calls[0][0].where.OR as Array<
      Record<string, unknown>
    >;
    expect(or).toHaveLength(3);
    expect(or[0]).toEqual({ deletedAt: null, expiresAt: { lt: NOW } });
    expect(or[1]).toEqual({
      deletedAt: { lt: new Date('2026-10-17T12:00:00Z') },
    });
    expect(or[2]).toEqual({
      status: 'FAILED',
      createdAt: { lt: new Date('2026-09-24T12:00:00Z') },
    });
  });

  it('keeps a SCHEDULED row inside the tombstone window: strips artifact + snapshot, no row delete', async () => {
    const t = build([]);
    const recent = new Date('2026-10-10T00:00:00Z');
    const old = new Date('2026-07-01T00:00:00Z'); // > 70 days before NOW
    t.findMany.mockReset();
    t.findMany.mockResolvedValueOnce([
      { id: 's1', artifactKey: 'k', origin: 'SCHEDULED', periodEnd: recent },
      { id: 's2', artifactKey: 'k2', origin: 'SCHEDULED', periodEnd: old },
      { id: 'o1', artifactKey: null, origin: 'ON_DEMAND', periodEnd: recent },
    ]);
    const snapDelete = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ count: 1 });
    const svc = new ReportRetentionService(
      {
        report: {
          findMany: t.findMany,
          deleteMany: t.deleteMany,
          updateMany: update,
        },
        reportSnapshot: { deleteMany: snapDelete },
      } as never,
      { delete: t.storageDelete } as never,
      logger() as never,
    );
    const res = await svc.cleanup(NOW);
    expect(res).toMatchObject({ tombstoned: 1, deleted: 2 });
    expect(snapDelete).toHaveBeenCalledWith({ where: { reportId: 's1' } });
    expect(update.mock.calls[0][0].data).toMatchObject({ artifactKey: null });
    const ids = t.deleteMany.mock.calls.map(
      (c: Array<{ where: { id: string } }>) => c[0].where.id,
    );
    expect(ids).toEqual(['s2', 'o1']);
  });

  it('is rerun-safe: a row whose delete already happened counts zero', async () => {
    const t = build([{ id: 'r1', artifactKey: 'k' }]);
    t.deleteMany.mockResolvedValue({ count: 0 });
    expect((await t.svc.cleanup(NOW)).deleted).toBe(0);
  });

  it('counts a row-delete failure without throwing', async () => {
    const t = build([{ id: 'r1', artifactKey: null }]);
    t.deleteMany.mockRejectedValue(new Error('db'));
    expect(await t.svc.cleanup(NOW)).toMatchObject({
      rowFailures: 1,
      deleted: 0,
    });
  });

  it('pages by id cursor up to maxBatches', async () => {
    const t = build([]);
    t.findMany.mockReset();
    t.findMany
      .mockResolvedValueOnce([
        { id: 'a', artifactKey: null },
        { id: 'b', artifactKey: null },
      ])
      .mockResolvedValueOnce([{ id: 'c', artifactKey: null }]);
    const res = await t.svc.cleanup(NOW, { batchSize: 2 });
    expect(t.findMany.mock.calls[1][0].where.id).toEqual({ gt: 'b' });
    expect(res.considered).toBe(3);
  });
});
