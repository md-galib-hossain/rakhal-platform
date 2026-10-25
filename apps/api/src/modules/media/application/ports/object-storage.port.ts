/** DI token for the object-storage adapter (R2 in prod, in-memory in test/dev). */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface GetObjectOptions {
  /** Reject (StorageObjectTooLargeError) instead of buffering an object larger than this. */
  maxBytes?: number;
}

/** Thrown by `get` when the object exceeds `opts.maxBytes`; nothing past the limit is buffered. */
export class StorageObjectTooLargeError extends Error {
  constructor(
    readonly key: string,
    readonly maxBytes: number,
  ) {
    super(`Object ${key} exceeds ${maxBytes} bytes`);
    this.name = 'StorageObjectTooLargeError';
  }
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Object-storage seam (RAKHAL-009). Backends: Cloudflare R2 (S3-compatible,
 * private bucket) and an in-memory fake for tests. Reads are always via
 * short-lived presigned GET URLs — the bucket is never public.
 */
export interface ObjectStoragePort {
  readonly provider: string;
  isConfigured(): boolean;
  put(input: PutObjectInput): Promise<void>;
  /** A presigned GET URL for `key`, valid for `expirySeconds`. */
  getSignedUrl(key: string, expirySeconds: number): Promise<string>;
  /** Fetches the object's bytes directly (server-side proxy, no signed URL). */
  get(key: string, opts?: GetObjectOptions): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
