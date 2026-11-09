"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_POLICY = exports.ALLOWED_INPUT_FORMATS = void 0;
exports.isAllowedFormat = isAllowedFormat;
exports.ALLOWED_INPUT_FORMATS = ['jpeg', 'png', 'webp'];
exports.IMAGE_POLICY = {
    limitInputPixels: 25_000_000,
    full: { maxEdge: 1600, quality: 82 },
    thumb: { edge: 320, quality: 70 },
    outputFormat: 'jpeg',
    outputContentType: 'image/jpeg',
};
function isAllowedFormat(format) {
    return (typeof format === 'string' &&
        exports.ALLOWED_INPUT_FORMATS.includes(format));
}
//# sourceMappingURL=image-policy.js.map