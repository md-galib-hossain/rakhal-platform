/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jest mock calls and asymmetric matchers are untyped */
import { HttpException } from '@nestjs/common';
import {
  canonicalJson,
  IDEMPOTENCY_RETENTION_DAYS,
  IDEMPOTENCY_STALE_MS,
  IdempotencyService,
} from './idempotency.service';

const uniqueViolation = Object.assign(new Error('unique'), { code: 'P2002' });
const KEY = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function build() {
  const prisma = {
    idempotencyKey: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const logger = {
    setContext: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
  };
  const svc = new IdempotencyService(prisma as never, logger as never);
  return { svc, prisma };
}

const input = (body: unknown = { a: 1 }, key: string | undefined = KEY) => ({
  farmId: 'farm-1',
  userId: 'user-1',
  endpoint: 'milk.saveLog',
  key,
  body,
});

describe('canonicalJson', () => {
  it('does not depend on property order, at any depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(
      canonicalJson({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }),
    );
  });

  it('treats an absent field like undefined, and different values differently', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });
});

describe('IdempotencyService.run', () => {
  it('runs the write with no bookkeeping when there is no key', async () => {
    const { svc, prisma } = build();
    const fn = jest.fn().mockResolvedValue({ ok: true });
    const out = await svc.run({ ...input(), key: undefined }, fn);
    expect(out).toEqual({ result: { ok: true }, replayed: false });
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed key with 400 and never runs the write', async () => {
    const { svc } = build();
    const fn = jest.fn();
    await expect(svc.run(input({ a: 1 }, 'short'), fn)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      svc.run(input({ a: 1 }, 'has spaces in it 123'), fn),
    ).rejects.toMatchObject({ status: 400 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('first call: reserves the key with hash and user, runs, stores the response', async () => {
    const { svc, prisma } = build();
    const fn = jest.fn().mockResolvedValue({ saved: 2 });
    const out = await svc.run(input(), fn);
    expect(out).toEqual({ result: { saved: 2 }, replayed: false });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        farmId: 'farm-1',
        key: KEY,
        endpoint: 'milk.saveLog',
        userId: 'user-1',
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    });
    expect(prisma.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { responseBody: { saved: 2 } } }),
    );
  });

  it('a repeat with the same body returns the stored response and does not run again', async () => {
    const first = build();
    await first.svc.run(input(), jest.fn().mockResolvedValue({ saved: 2 }));
    const stored = first.prisma.idempotencyKey.create.mock.calls[0][0].data;

    const { svc, prisma } = build();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: stored.requestHash,
      responseBody: { saved: 2 },
      createdAt: new Date(),
    });
    const fn = jest.fn();
    const out = await svc.run(input({ a: 1 }), fn);
    expect(out).toEqual({ result: { saved: 2 }, replayed: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it('the same key with a different body is 422 IDEMPOTENCY_KEY_REUSED, never the old response', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: 'f'.repeat(64),
      responseBody: { saved: 2 },
      createdAt: new Date(),
    });
    const fn = jest.fn();
    const err = await svc.run(input({ a: 2 }), fn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(422);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('a row from an older helper (no hash) replays without a hash check', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: null,
      responseBody: { saved: 1 },
      createdAt: new Date(),
    });
    const out = await svc.run(input({ anything: true }), jest.fn());
    expect(out.replayed).toBe(true);
  });

  it('a request still in flight is 409 IDEMPOTENCY_IN_PROGRESS', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.create.mockRejectedValue(uniqueViolation);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: null,
      responseBody: null,
      createdAt: new Date(),
    });
    const fn = jest.fn();
    const err = await svc.run(input(), fn).catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(409);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('an abandoned reservation (process died mid-request) is cleared once and the write runs', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.create
      .mockRejectedValueOnce(uniqueViolation)
      .mockResolvedValueOnce({});
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k1',
      requestHash: null,
      responseBody: null,
      createdAt: new Date(Date.now() - IDEMPOTENCY_STALE_MS - 1000),
    });
    const fn = jest.fn().mockResolvedValue({ saved: 3 });
    const out = await svc.run(input(), fn);
    expect(out).toEqual({ result: { saved: 3 }, replayed: false });
    expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'k1' }),
    });
  });

  it('a failed write releases the key so the retry runs again, and rethrows', async () => {
    const { svc, prisma } = build();
    const boom = new Error('db down');
    await expect(
      svc.run(input(), jest.fn().mockRejectedValue(boom)),
    ).rejects.toBe(boom);
    expect(prisma.idempotencyKey.delete).toHaveBeenCalled();
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it('a committed write is not reported as failed when storing the response fails', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.update.mockRejectedValue(new Error('db blip'));
    const out = await svc.run(
      input(),
      jest.fn().mockResolvedValue({ saved: 1 }),
    );
    expect(out).toEqual({ result: { saved: 1 }, replayed: false });
    expect(prisma.idempotencyKey.delete).not.toHaveBeenCalled();
  });

  it('rethrows any error other than a unique violation from the reservation', async () => {
    const { svc, prisma } = build();
    const boom = new Error('connection lost');
    prisma.idempotencyKey.create.mockRejectedValue(boom);
    await expect(svc.run(input(), jest.fn())).rejects.toBe(boom);
  });
});

describe('IdempotencyService.purgeExpired', () => {
  it('deletes only rows older than the retention window', async () => {
    const { svc, prisma } = build();
    prisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 4 });
    const now = new Date('2026-12-31T00:00:00.000Z');
    expect(await svc.purgeExpired(now)).toBe(4);
    const cutoff = prisma.idempotencyKey.deleteMany.mock.calls[0][0].where
      .createdAt.lt as Date;
    expect(now.getTime() - cutoff.getTime()).toBe(
      IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});
