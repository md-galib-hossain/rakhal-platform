"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLotBacked = void 0;
exports.lineKey = lineKey;
function lineKey(line) {
    if (line.feedItemId) {
        return line.feedItemBatchId
            ? `${line.feedItemId}:${line.feedItemBatchId}`
            : line.feedItemId;
    }
    if (!line.ingredientId) {
        throw new Error('A recipe line needs an ingredientId or a feedItemId');
    }
    return line.ingredientId;
}
const isLotBacked = (line) => line.feedItemId != null;
exports.isLotBacked = isLotBacked;
//# sourceMappingURL=recipe-line.js.map