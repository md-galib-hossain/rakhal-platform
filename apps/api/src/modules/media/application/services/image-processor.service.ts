import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { IMAGE_POLICY, isAllowedFormat } from '../../domain/image-policy';

export interface ProcessedVariant {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
}

export interface ProcessedImage {
  full: ProcessedVariant;
  thumb: ProcessedVariant;
  detectedFormat: string;
}

/**
 * Sharp image pipeline (RAKHAL-009). This is the **real** validator: it decodes
 * the bytes (a renamed non-image fails here), rejects anything outside the
 * jpeg/png/webp allowlist, then re-encodes to JPEG — which strips EXIF/GPS and
 * neutralizes any payload embedded in the original file. Produces a full +
 * square-thumb variant. The original bytes are never persisted.
 */
@Injectable()
export class ImageProcessorService {
  async process(input: Buffer): Promise<ProcessedImage> {
    const options: sharp.SharpOptions = {
      limitInputPixels: IMAGE_POLICY.limitInputPixels,
      failOn: 'error',
    };

    let detectedFormat: string | undefined;
    try {
      const meta = await sharp(input, options).metadata();
      detectedFormat = meta.format;
    } catch {
      throw new BadRequestException('File is not a valid image');
    }
    if (!isAllowedFormat(detectedFormat)) {
      throw new BadRequestException(
        `Unsupported image format: ${detectedFormat ?? 'unknown'} (allowed: JPEG, PNG, WebP)`,
      );
    }

    const [full, thumb] = await Promise.all([
      sharp(input, options)
        .rotate() // apply EXIF orientation, then metadata is dropped on encode
        .resize({
          width: IMAGE_POLICY.full.maxEdge,
          height: IMAGE_POLICY.full.maxEdge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMAGE_POLICY.full.quality })
        .toBuffer({ resolveWithObject: true }),
      sharp(input, options)
        .rotate()
        .resize({
          width: IMAGE_POLICY.thumb.edge,
          height: IMAGE_POLICY.thumb.edge,
          fit: 'cover',
        })
        .jpeg({ quality: IMAGE_POLICY.thumb.quality })
        .toBuffer({ resolveWithObject: true }),
    ]);

    return {
      detectedFormat,
      full: {
        buffer: full.data,
        width: full.info.width,
        height: full.info.height,
        byteSize: full.info.size,
      },
      thumb: {
        buffer: thumb.data,
        width: thumb.info.width,
        height: thumb.info.height,
        byteSize: thumb.info.size,
      },
    };
  }
}
