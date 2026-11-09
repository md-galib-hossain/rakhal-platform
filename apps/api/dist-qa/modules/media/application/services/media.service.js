"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MediaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const env_1 = require("src/core/config/env");
const media_key_1 = require("../../domain/media-key");
const object_storage_port_1 = require("../ports/object-storage.port");
const image_processor_service_1 = require("./image-processor.service");
let MediaService = MediaService_1 = class MediaService {
    prisma;
    storage;
    imageProcessor;
    log;
    constructor(prisma, storage, imageProcessor, logger) {
        this.prisma = prisma;
        this.storage = storage;
        this.imageProcessor = imageProcessor;
        this.log = logger.setContext(MediaService_1.name);
    }
    async uploadImage(params) {
        const { farmId, uploadedByUserId, category, usage, file } = params;
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('No image file was provided');
        }
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(file.buffer).digest('hex');
        const asset = await this.prisma.mediaAsset.create({
            data: {
                farmId,
                uploadedByUserId,
                category,
                usage,
                status: client_1.MediaStatus.PENDING,
                originalFileName: file.originalname ?? null,
                originalByteSize: file.size ?? file.buffer.length,
                sha256,
            },
        });
        try {
            const processed = await this.imageProcessor.process(file.buffer);
            const keys = (0, media_key_1.buildMediaKeys)(farmId, category, asset.id);
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
            const variants = {
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
                    status: client_1.MediaStatus.READY,
                    detectedFormat: processed.detectedFormat,
                    width: processed.full.width,
                    height: processed.full.height,
                    processedByteSize: processed.full.byteSize + processed.thumb.byteSize,
                    variants: variants,
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
        }
        catch (err) {
            await this.prisma.mediaAsset
                .update({
                where: { id: asset.id },
                data: { status: client_1.MediaStatus.FAILED },
            })
                .catch(() => undefined);
            if (err instanceof common_1.BadRequestException)
                throw err;
            this.log.error('Media processing/upload failed', err, {
                assetId: asset.id,
                farmId,
            });
            throw new common_1.InternalServerErrorException('Failed to process the image');
        }
    }
    async signUrls(asset, includeFull) {
        const variants = asset.variants;
        if (!variants?.thumb?.key) {
            throw new common_1.NotFoundException('Image is not available');
        }
        const expiry = env_1.env.R2_PRESIGN_EXPIRY_SECONDS;
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
    async presentUrls(farmId, id, includeFull) {
        const asset = await this.getReadyScopedOrThrow(farmId, id);
        return this.signUrls(asset, includeFull);
    }
    async signThumbs(farmId, ids) {
        const out = new Map();
        const unique = [...new Set(ids)].filter(Boolean);
        if (unique.length === 0)
            return out;
        const assets = await this.prisma.mediaAsset.findMany({
            where: { id: { in: unique }, farmId, status: client_1.MediaStatus.READY },
        });
        await Promise.all(assets.map(async (asset) => {
            out.set(asset.id, await this.signUrls(asset, false));
        }));
        return out;
    }
    async softDeleteById(farmId, id, byUserId) {
        const asset = await this.prisma.mediaAsset.findFirst({
            where: { id, farmId },
        });
        if (!asset || asset.status === client_1.MediaStatus.DELETED)
            return;
        await this.prisma.mediaAsset.update({
            where: { id: asset.id },
            data: {
                status: client_1.MediaStatus.DELETED,
                deletedAt: new Date(),
                deletedByUserId: byUserId,
            },
        });
        const variants = asset.variants;
        if (variants) {
            await Promise.all([
                this.storage.delete(variants.full.key).catch(() => undefined),
                this.storage.delete(variants.thumb.key).catch(() => undefined),
            ]);
        }
    }
    async getReadyScopedOrThrow(farmId, id) {
        const asset = await this.prisma.mediaAsset.findFirst({
            where: { id, farmId },
        });
        if (!asset || asset.status === client_1.MediaStatus.DELETED) {
            throw new common_1.NotFoundException('Image not found');
        }
        if (asset.status !== client_1.MediaStatus.READY) {
            throw new common_1.NotFoundException('Image is not ready');
        }
        return asset;
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = MediaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(object_storage_port_1.OBJECT_STORAGE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, image_processor_service_1.ImageProcessorService,
        logger_service_1.LoggerService])
], MediaService);
//# sourceMappingURL=media.service.js.map