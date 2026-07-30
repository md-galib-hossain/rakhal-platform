import { Injectable } from '@nestjs/common';
import {
  ObjectStoragePort,
  PutObjectInput,
} from '../../application/ports/object-storage.port';

/**
 * In-memory object storage (RAKHAL-009) — used in `NODE_ENV=test` (so the suite
 * never touches the real R2 bucket) and as the dev fallback when R2 creds aren't
 * set. Keeps bytes in a Map and returns a `memory://` URL in place of a presigned
 * one; the Sharp pipeline still runs for real against it.
 *
 * The map is `static` (process-wide, not per-instance): each e2e spec file
 * boots its own `TestingModule`/app (a fresh `MemoryStorageAdapter` instance),
 * but they all share the same real Redis-backed BullMQ queue — if one file's
 * app hasn't fully torn down its worker before the next file's app enqueues a
 * job, the *old* app's worker can still pick it up. An instance-level Map
 * would make that write invisible to the *new* app's read. A real R2 bucket
 * doesn't have this problem (one shared bucket regardless of process); this
 * mirrors that for the fake.
 */
@Injectable()
export class MemoryStorageAdapter implements ObjectStoragePort {
  readonly provider = 'memory';
  private static readonly store = new Map<string, Buffer>();

  isConfigured(): boolean {
    return true;
  }

  put(input: PutObjectInput): Promise<void> {
    MemoryStorageAdapter.store.set(input.key, input.body);
    return Promise.resolve();
  }

  getSignedUrl(key: string, expirySeconds: number): Promise<string> {
    return Promise.resolve(`memory://${key}?expires=${expirySeconds}`);
  }

  get(key: string): Promise<Buffer> {
    const body = MemoryStorageAdapter.store.get(key);
    if (!body) return Promise.reject(new Error(`Object not found: ${key}`));
    return Promise.resolve(body);
  }

  delete(key: string): Promise<void> {
    MemoryStorageAdapter.store.delete(key);
    return Promise.resolve();
  }
}
