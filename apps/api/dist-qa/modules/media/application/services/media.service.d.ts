import { MediaAsset, MediaCategory, MediaUsage } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { type ObjectStoragePort } from '../ports/object-storage.port';
import { ImageProcessorService } from './image-processor.service';
export interface UploadImageParams {
    farmId: string;
    uploadedByUserId: string;
    category: MediaCategory;
    usage: MediaUsage;
    file: {
        buffer: Buffer;
        originalname?: string;
        size?: number;
    };
}
export interface MediaUrls {
    asset_id: string;
    thumb_url: string;
    full_url: string | null;
    width: number | null;
    height: number | null;
    expires_at: string;
}
export declare class MediaService {
    private readonly prisma;
    private readonly storage;
    private readonly imageProcessor;
    private readonly log;
    constructor(prisma: PrismaService, storage: ObjectStoragePort, imageProcessor: ImageProcessorService, logger: LoggerService);
    uploadImage(params: UploadImageParams): Promise<MediaAsset>;
    signUrls(asset: MediaAsset, includeFull: boolean): Promise<MediaUrls>;
    presentUrls(farmId: string, id: string, includeFull: boolean): Promise<MediaUrls>;
    signThumbs(farmId: string, ids: string[]): Promise<Map<string, MediaUrls>>;
    softDeleteById(farmId: string, id: string, byUserId: string): Promise<void>;
    private getReadyScopedOrThrow;
}
