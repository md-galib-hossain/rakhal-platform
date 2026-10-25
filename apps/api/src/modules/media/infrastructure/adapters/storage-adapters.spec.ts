import { Readable } from 'stream';
import { StorageObjectTooLargeError } from '../../application/ports/object-storage.port';
import { MemoryStorageAdapter } from './memory-storage.adapter';
import { R2StorageAdapter } from './r2-storage.adapter';

const send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  GetObjectCommand: jest.fn().mockImplementation((i: unknown) => i),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.mock('src/core/config/env', () => ({
  env: {
    R2_ACCOUNT_ID: 'a',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'b',
  },
}));

describe('MemoryStorageAdapter.get maxBytes', () => {
  it('rejects an over-limit object, allows at-limit and unbounded reads', async () => {
    const m = new MemoryStorageAdapter();
    await m.put({ key: 'k1', body: Buffer.alloc(10), contentType: 'x' });
    await expect(m.get('k1', { maxBytes: 9 })).rejects.toBeInstanceOf(
      StorageObjectTooLargeError,
    );
    await expect(m.get('k1', { maxBytes: 10 })).resolves.toHaveLength(10);
    await expect(m.get('k1')).resolves.toHaveLength(10);
  });
});

describe('R2StorageAdapter.get maxBytes', () => {
  beforeEach(() => send.mockReset());

  it('rejects on ContentLength before reading any chunk', async () => {
    const body = Readable.from([Buffer.alloc(5)]);
    const destroy = jest.spyOn(body, 'destroy');
    send.mockResolvedValue({ Body: body, ContentLength: 100 });
    await expect(
      new R2StorageAdapter().get('k', { maxBytes: 50 }),
    ).rejects.toBeInstanceOf(StorageObjectTooLargeError);
    expect(destroy).toHaveBeenCalled();
  });

  it('aborts mid-stream when ContentLength is missing', async () => {
    const body = Readable.from([Buffer.alloc(30), Buffer.alloc(30)]);
    send.mockResolvedValue({ Body: body });
    await expect(
      new R2StorageAdapter().get('k', { maxBytes: 50 }),
    ).rejects.toBeInstanceOf(StorageObjectTooLargeError);
  });

  it('returns the bytes when within the limit', async () => {
    send.mockResolvedValue({
      Body: Readable.from([Buffer.alloc(20)]),
      ContentLength: 20,
    });
    await expect(
      new R2StorageAdapter().get('k', { maxBytes: 50 }),
    ).resolves.toHaveLength(20);
  });
});
