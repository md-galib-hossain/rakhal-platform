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
 */
@Injectable()
export class MemoryStorageAdapter implements ObjectStoragePort {
  readonly provider = 'memory';
  private readonly store = new Map<string, Buffer>();

  isConfigured(): boolean {
    return true;
  }

  put(input: PutObjectInput): Promise<void> {
    this.store.set(input.key, input.body);
    return Promise.resolve();
  }

  getSignedUrl(key: string, expirySeconds: number): Promise<string> {
    return Promise.resolve(`memory://${key}?expires=${expirySeconds}`);
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
