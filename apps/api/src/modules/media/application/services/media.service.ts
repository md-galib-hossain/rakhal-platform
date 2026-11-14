import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  MediaAsset,
  MediaCategory,
  MediaStatus,
  MediaUsage,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { env } from 'src/core/config/env';
import { buildMediaKeys } from '../../domain/media-key';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../ports/object-storage.port';
import { ImageProcessorService } from './image-processor.service';

interface VariantDescriptor {
  key: string;
  width: number;
  height: number;
  byteSize: number;
}
interface MediaVariants {
  full: VariantDescriptor;
  thumb: VariantDescriptor;
}

export interface UploadImageParams {
  farmId: string;
  uploadedByUserId: string;
  category: MediaCategory;
  usage: MediaUsage;
  file: { buffer: Buffer; originalname?: string; size?: number };
}

/** Presigned view of an asset returned to clients (never the raw R2 keys). */
export interface MediaUrls {
  asset_id: string;
  thumb_url: string;
  full_url: string | null;
  width: number | null;
  height: number | null;
  expires_at: string;
}

/**
 * Media orchestrator (RAKHAL-009). Owns the `MediaAsset` lifecycle
 * (PENDING → READY | FAILED → DELETED): validate + process with Sharp, store the
 * variants in R2, and hand back short-lived presigned URLs. Reusable by any
 * consumer (cattle photos now; health/repro/avatars later). All reads are
 * farm-scoped — an asset is only ever returned to its owning farm.
 */
@Injectable()
export class MediaService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly imageProcessor: ImageProcessorService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MediaService.name);
  }

  /**
   * Validate + process + store an uploaded image. Creates a PENDING row (which
   * reserves the id used in the object key), runs Sharp, uploads both variants,
   * then flips the row READY. On any failure the row is marked FAILED (the
   * cleanup sweep reclaims it) — DB and R2 can't be atomic, so status is the
   * reconciliation anchor.
   */
  async uploadImage(params: UploadImageParams): Promise<MediaAsset> {
    const { farmId, uploadedByUserId, category, usage, file } = params;
    if (!file?.buffer?.length) {
      throw new BadRequestException('No image file was provided');
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const asset = await this.prisma.mediaAsset.create({
      data: {
        farmId,
        uploadedByUserId,
        category,
        usage,
        status: MediaStatus.PENDING,
        originalFileName: file.originalname ?? null,
        originalByteSize: file.size ?? file.buffer.length,
        sha256,
      },
    });

    try {
      const processed = await this.imageProcessor.process(file.buffer);
      const keys = buildMediaKeys(farmId, category, asset.id);

      await Promise.all([
        this.storage.put({
          key: keys.full,
          body: processed.full.buffer,
          contentType: 'image/jpeg',
        }),
        this.storage.put({
          key: keys.thumb,
          body: processed.thumb.buffer,
          contentType: 'image/jpeg',
        }),
      ]);

      const variants: MediaVariants = {
        full: {
          key: keys.full,
          width: processed.full.width,
          height: processed.full.height,
          byteSize: processed.full.byteSize,
        },
        thumb: {
          key: keys.thumb,
          width: processed.thumb.width,
          height: processed.thumb.height,
          byteSize: processed.thumb.byteSize,
        },
      };

      const ready = await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: MediaStatus.READY,
          detectedFormat: processed.detectedFormat,
          width: processed.full.width,
          height: processed.full.height,
          processedByteSize: processed.full.byteSize + processed.thumb.byteSize,
          variants: variants as unknown as Prisma.InputJsonValue,
        },
      });
      this.log.info('Media asset processed', {
        assetId: asset.id,
        farmId,
        category,
        usage,
        bytes: ready.processedByteSize,
      });
      return ready;
    } catch (err) {
      await this.prisma.mediaAsset
        .update({
          where: { id: asset.id },
          data: { status: MediaStatus.FAILED },
        })
        .catch(() => undefined);
      // A bad image is a client error (400); anything else (storage) is a 500.
      if (err instanceof BadRequestException) throw err;
      this.log.error('Media processing/upload failed', err, {
        assetId: asset.id,
        farmId,
      });
      throw new InternalServerErrorException('Failed to process the image');
    }
  }

  /** Build presigned URLs for a READY asset (thumb always; full on demand). */
  async signUrls(asset: MediaAsset, includeFull: boolean): Promise<MediaUrls> {
    const variants = asset.variants as unknown as MediaVariants | null;
    if (!variants?.thumb?.key) {
      throw new NotFoundException('Image is not available');
    }
    const expiry = env.R2_PRESIGN_EXPIRY_SECONDS;
    const [thumbUrl, fullUrl] = await Promise.all([
      this.storage.getSignedUrl(variants.thumb.key, expiry),
      includeFull
        ? this.storage.getSignedUrl(variants.full.key, expiry)
        : Promise.resolve(null),
    ]);
    return {
      asset_id: asset.id,
      thumb_url: thumbUrl,
      full_url: fullUrl,
      width: asset.width,
      height: asset.height,
      expires_at: new Date(Date.now() + expiry * 1000).toISOString(),
    };
  }

  /** `GET /media/:id/url` — farm-scoped, READY only. */
  async presentUrls(
    farmId: string,
    id: string,
    includeFull: boolean,
  ): Promise<MediaUrls> {
    const asset = await this.getReadyScopedOrThrow(farmId, id);
    return this.signUrls(asset, includeFull);
  }

  /**
   * Sign thumbnails for many assets in one shot (used to enrich list responses).
   * Only READY assets belonging to `farmId` are returned; unknown/foreign ids
   * are silently dropped. Presigning is a local HMAC, so this is cheap.
   */
  async signThumbs(
    farmId: string,
    ids: string[],
  ): Promise<Map<string, MediaUrls>> {
    const out = new Map<string, MediaUrls>();
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return out;

    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: unique }, farmId, status: MediaStatus.READY },
    });
    await Promise.all(
      assets.map(async (asset) => {
        out.set(asset.id, await this.signUrls(asset, false));
      }),
    );
    return out;
  }

  /** Soft-delete (status DELETED) + best-effort removal of both R2 objects. */
  async softDeleteById(
    farmId: string,
    id: string,
    byUserId: string,
  ): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, farmId },
    });
    if (!asset || asset.status === MediaStatus.DELETED) return;

    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: MediaStatus.DELETED,
        deletedAt: new Date(),
        deletedByUserId: byUserId,
      },
    });

    const variants = asset.variants as unknown as MediaVariants | null;
    if (variants) {
      await Promise.all([
        this.storage.delete(variants.full.key).catch(() => undefined),
        this.storage.delete(variants.thumb.key).catch(() => undefined),
      ]);
    }
  }

  private async getReadyScopedOrThrow(
    farmId: string,
    id: string,
  ): Promise<MediaAsset> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, farmId },
    });
    if (!asset || asset.status === MediaStatus.DELETED) {
      throw new NotFoundException('Image not found');
    }
    if (asset.status !== MediaStatus.READY) {
      throw new NotFoundException('Image is not ready');
    }
    return asset;
  }
}
