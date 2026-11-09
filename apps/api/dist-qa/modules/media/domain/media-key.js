"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMediaKeys = buildMediaKeys;
function buildMediaKeys(farmId, category, mediaId) {
    const base = `farms/${farmId}/${category.toLowerCase()}/${mediaId}`;
    return { full: `${base}/full.jpg`, thumb: `${base}/thumb.jpg` };
}
//# sourceMappingURL=media-key.js.map