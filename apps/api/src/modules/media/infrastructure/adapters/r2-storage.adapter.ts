import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from 'src/core/config/env';
import {
  ObjectStoragePort,
  PutObjectInput,
} from '../../application/ports/object-storage.port';

/**
 * Cloudflare R2 adapter (RAKHAL-009) — S3-compatible, **private** bucket. Talks
 * to `https://<account>.r2.cloudflarestorage.com` (region `auto`) with the AWS
 * S3 SDK. Reads are short-lived presigned GET URLs (local HMAC, no R2 round-trip),
 * so the bucket never needs public access.
 */
@Injectable()
export class R2StorageAdapter implements ObjectStoragePort {
  readonly provider = 'r2';
  private client?: S3Client;

  isConfigured(): boolean {
    return Boolean(
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
    );
  }

  async put(input: PutObjectInput): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  getSignedUrl(key: string, expirySeconds: number): Promise<string> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
      { expiresIn: expirySeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }),
    );
  }

  private bucket(): string {
    const bucket = env.R2_BUCKET;
    if (!bucket) throw new Error('R2_BUCKET is not configured');
    return bucket;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = env.R2_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not configured');
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }
}
