"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessorService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const image_policy_1 = require("../../domain/image-policy");
let ImageProcessorService = class ImageProcessorService {
    async process(input) {
        const options = {
            limitInputPixels: image_policy_1.IMAGE_POLICY.limitInputPixels,
            failOn: 'error',
        };
        let detectedFormat;
        try {
            const meta = await (0, sharp_1.default)(input, options).metadata();
            detectedFormat = meta.format;
        }
        catch {
            throw new common_1.BadRequestException('File is not a valid image');
        }
        if (!(0, image_policy_1.isAllowedFormat)(detectedFormat)) {
            throw new common_1.BadRequestException(`Unsupported image format: ${detectedFormat ?? 'unknown'} (allowed: JPEG, PNG, WebP)`);
        }
        const [full, thumb] = await Promise.all([
            (0, sharp_1.default)(input, options)
                .rotate()
                .resize({
                width: image_policy_1.IMAGE_POLICY.full.maxEdge,
                height: image_policy_1.IMAGE_POLICY.full.maxEdge,
                fit: 'inside',
                withoutEnlargement: true,
            })
                .jpeg({ quality: image_policy_1.IMAGE_POLICY.full.quality })
                .toBuffer({ resolveWithObject: true }),
            (0, sharp_1.default)(input, options)
                .rotate()
                .resize({
                width: image_policy_1.IMAGE_POLICY.thumb.edge,
                height: image_policy_1.IMAGE_POLICY.thumb.edge,
                fit: 'cover',
            })
                .jpeg({ quality: image_policy_1.IMAGE_POLICY.thumb.quality })
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
};
exports.ImageProcessorService = ImageProcessorService;
exports.ImageProcessorService = ImageProcessorService = __decorate([
    (0, common_1.Injectable)()
], ImageProcessorService);
//# sourceMappingURL=image-processor.service.js.map